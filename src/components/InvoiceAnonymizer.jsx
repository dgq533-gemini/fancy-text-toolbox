import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * 纯前端离线发票与收据脱敏裁剪器
 * - 图片导入：拖拽或点击上传 PNG/JPG
 * - 鼠标框选：在画布上拖动绘制红色虚线框
 * - 像素级涂黑：彻底销毁选中区域像素（不可逆）
 * - 旋转 / 裁剪 / 下载
 * - 所有处理均在本地 Canvas 完成，不上传服务器
 */
export default function InvoiceAnonymizer() {
  const canvasRef = useRef(null)
  const offscreenRef = useRef(null) // 离屏画布：存储底图（不含选区框）
  const fileInputRef = useRef(null)
  const currentUrlRef = useRef(null)
  const loadedImgRef = useRef(null) // 暂存已加载的 Image 对象，待 canvas 挂载后绘制

  // 组件挂载时创建离屏 canvas
  useEffect(() => {
    offscreenRef.current = document.createElement('canvas')
  }, [])

  const [imgLoaded, setImgLoaded] = useState(false)
  const [selections, setSelections] = useState([]) // {x,y,w,h} 图像原始坐标
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [currentRect, setCurrentRect] = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [applied, setApplied] = useState(false)

  // ---- 将鼠标坐标转换为画布原始坐标 ----
  const getCanvasCoords = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: Math.round((e.clientX - rect.left) * (canvas.width / rect.width)),
      y: Math.round((e.clientY - rect.top) * (canvas.height / rect.height)),
    }
  }, [])

  // ---- 重绘：从离屏底图重绘主画布，再叠加选区框 ----
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const off = offscreenRef.current
    if (!canvas || !off || !imgLoaded) return
    const ctx = canvas.getContext('2d')
    // 用离屏底图覆盖主画布（清除旧选区框）
    ctx.drawImage(off, 0, 0)
    const lineW = Math.max(2, canvas.width / 500)
    // 绘制已确认的选区（红色虚线框）
    selections.forEach((s) => {
      ctx.save()
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = lineW
      ctx.setLineDash([8, 6])
      ctx.strokeRect(s.x, s.y, s.w, s.h)
      ctx.restore()
    })
    // 绘制正在拖动的选区（橙色虚线框）
    if (currentRect) {
      ctx.save()
      ctx.strokeStyle = '#f97316'
      ctx.lineWidth = lineW
      ctx.setLineDash([6, 4])
      ctx.strokeRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h)
      ctx.restore()
    }
  }, [imgLoaded, selections, currentRect])

  useEffect(() => {
    redraw()
  }, [redraw])

  // ---- 加载图片 ----
  const loadImageFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      // canvas 此时可能尚未挂载（imgLoaded=false 时不渲染 canvas），
      // 先暂存 Image，由下面的 useEffect 在 canvas 挂载后绘制
      loadedImgRef.current = img
      if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current)
      currentUrlRef.current = url
      setImgLoaded(true)
      setSelections([])
      setApplied(false)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      alert('图片加载失败，请重试')
    }
    img.src = url
  }, [])

  // 当 imgLoaded 变为 true 时，canvas 已挂载，此时将图片绘制到画布
  useEffect(() => {
    if (!imgLoaded) return
    const canvas = canvasRef.current
    const off = offscreenRef.current
    const img = loadedImgRef.current
    if (canvas && off && img) {
      canvas.width = off.width = img.naturalWidth
      canvas.height = off.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      off.getContext('2d').drawImage(img, 0, 0)
    }
  }, [imgLoaded])

  const handleFileInput = (e) => {
    const file = e.target.files?.[0]
    if (file) loadImageFile(file)
    e.target.value = ''
  }

  // ---- 拖拽上传 ----
  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragOver(false) }
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) loadImageFile(file)
  }

  // ---- 鼠标框选 ----
  const handleMouseDown = (e) => {
    if (!imgLoaded) return
    const { x, y } = getCanvasCoords(e)
    setIsDragging(true)
    setDragStart({ x, y })
    setCurrentRect({ x, y, w: 0, h: 0 })
  }

  const handleMouseMove = (e) => {
    if (!isDragging || !dragStart) return
    const { x, y } = getCanvasCoords(e)
    setCurrentRect({
      x: Math.min(dragStart.x, x),
      y: Math.min(dragStart.y, y),
      w: Math.abs(x - dragStart.x),
      h: Math.abs(y - dragStart.y),
    })
  }

  const handleMouseUp = () => {
    if (isDragging && currentRect && currentRect.w > 5 && currentRect.h > 5) {
      setSelections((prev) => [...prev, currentRect])
    }
    setIsDragging(false); setDragStart(null); setCurrentRect(null)
  }

  // ---- 像素级涂黑：在主画布和离屏底图上同时覆盖黑色，不可逆 ----
  const handleApplyBlackout = () => {
    if (!imgLoaded || selections.length === 0) return
    const canvas = canvasRef.current
    const off = offscreenRef.current
    if (!canvas || !off) return
    const ctx = canvas.getContext('2d')
    const offCtx = off.getContext('2d')
    selections.forEach((s) => {
      ctx.fillStyle = '#000000'
      ctx.fillRect(s.x, s.y, s.w, s.h)
      offCtx.fillStyle = '#000000'
      offCtx.fillRect(s.x, s.y, s.w, s.h)
    })
    setSelections([])
    setApplied(true)
  }

  const handleUndoSelection = () => setSelections((p) => p.slice(0, -1))
  const handleClearSelections = () => setSelections([])

  // ---- 顺时针旋转 90 度 ----
  const handleRotate = () => {
    if (!imgLoaded) return
    const canvas = canvasRef.current
    const off = offscreenRef.current
    if (!canvas || !off) return
    const w = canvas.width, h = canvas.height
    const nc = document.createElement('canvas')
    nc.width = h; nc.height = w
    const nctx = nc.getContext('2d')
    nctx.translate(h, 0); nctx.rotate(Math.PI / 2); nctx.drawImage(off, 0, 0)
    canvas.width = off.width = h
    canvas.height = off.height = w
    canvas.getContext('2d').drawImage(nc, 0, 0)
    off.getContext('2d').drawImage(nc, 0, 0)
    setSelections([])
  }

  // ---- 裁剪选中区域 ----
  const handleCrop = () => {
    if (!imgLoaded || selections.length === 0) return
    const canvas = canvasRef.current
    const off = offscreenRef.current
    if (!canvas || !off) return
    const s = selections[selections.length - 1]
    const data = canvas.getContext('2d').getImageData(s.x, s.y, s.w, s.h)
    canvas.width = off.width = s.w
    canvas.height = off.height = s.h
    canvas.getContext('2d').putImageData(data, 0, 0)
    off.getContext('2d').putImageData(data, 0, 0)
    setSelections([])
  }

  // ---- 重置：从 blob URL 重新加载原图 ----
  const handleReset = () => {
    if (!currentUrlRef.current) return
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      const off = offscreenRef.current
      if (canvas && off) {
        canvas.width = off.width = img.naturalWidth
        canvas.height = off.height = img.naturalHeight
        canvas.getContext('2d').drawImage(img, 0, 0)
        off.getContext('2d').drawImage(img, 0, 0)
      }
      setImgLoaded(true); setSelections([]); setApplied(false)
    }
    img.src = currentUrlRef.current
  }

  // ---- 下载 ----
  const handleDownload = () => {
    if (!imgLoaded) return
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `anonymized-invoice-${Date.now()}.png`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png', 1.0)
  }

  // ---- 卸载时清理内存 ----
  useEffect(() => {
    return () => {
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current)
        currentUrlRef.current = null
      }
      offscreenRef.current = null
      setImgLoaded(false); setSelections([]); setCurrentRect(null)
    }
  }, [])

  return (
    <div className="space-y-4">
      {/* 安全提示 */}
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
        <p className="text-red-600 text-sm font-bold leading-relaxed">
          🔒 本工具 100% 纯前端本地处理，断网也能用，没有任何图片会上传到服务器，绝对保护您的财务与个人隐私！
        </p>
      </div>

      {/* 图片上传区 */}
      {!imgLoaded ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`bg-white rounded-2xl border-2 border-dashed p-10 sm:p-16 text-center cursor-pointer transition-all ${
            isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <div className="text-5xl mb-4">📄</div>
          <p className="text-gray-700 font-medium mb-1">拖拽发票/收据图片到这里</p>
          <p className="text-gray-400 text-sm">或点击此处选择文件（支持 PNG / JPG）</p>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleFileInput} className="hidden" />
        </div>
      ) : (
        <>
          {/* 工具栏 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4">
            <div className="flex flex-wrap gap-2">
              <button onClick={handleApplyBlackout} disabled={selections.length === 0}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  selections.length === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600 active:scale-95'
                }`}>🔒 应用涂黑</button>
              <button onClick={handleUndoSelection} disabled={selections.length === 0}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  selections.length === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95'
                }`}>↩️ 撤销选区</button>
              <button onClick={handleClearSelections} disabled={selections.length === 0}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  selections.length === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95'
                }`}>🗑️ 清除选区</button>
              <button onClick={handleRotate}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all">🔄 旋转90°</button>
              <button onClick={handleCrop} disabled={selections.length === 0}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  selections.length === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95'
                }`}>✂️ 裁剪选区</button>
              <button onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all">🔁 重置原图</button>
              <button onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all">📁 换一张</button>
              <button onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold bg-green-500 text-white hover:bg-green-600 active:scale-95 transition-all ml-auto">⬇️ 下载脱敏图片</button>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleFileInput} className="hidden" />
            </div>
            {selections.length > 0 && <p className="mt-2 text-xs text-gray-400">已绘制 {selections.length} 个选区，点击「应用涂黑」销毁敏感信息</p>}
            {applied && <p className="mt-2 text-xs text-green-600 font-medium">✅ 敏感信息已彻底涂黑，像素不可还原</p>}
          </div>

          {/* 画布区域 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4 overflow-auto">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="max-w-full h-auto rounded-lg cursor-crosshair select-none"
              style={{ display: 'block', margin: '0 auto' }}
            />
          </div>

          {/* 操作提示 */}
          <div className="text-center text-xs text-gray-400 space-y-1">
            <p>🖱️ 在图片上按住鼠标拖动，框选需要脱敏的敏感区域</p>
            <p>🔒 点击「应用涂黑」后，选中区域的像素将被彻底销毁，无法还原</p>
          </div>
        </>
      )}
    </div>
  )
}
