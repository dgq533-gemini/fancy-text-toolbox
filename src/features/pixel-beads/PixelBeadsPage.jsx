import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import BackButton from '../../components/BackButton'
import Footer from '../../components/Footer'

// 拼豆标准色板（24色，用于颜色匹配）
const BEAD_PALETTE = [
  { name: '黑色',   hex: '#1a1a1a', rgb: [26, 26, 26] },
  { name: '白色',   hex: '#ffffff', rgb: [255, 255, 255] },
  { name: '红色',   hex: '#e53935', rgb: [229, 57, 53] },
  { name: '深红',   hex: '#b71c1c', rgb: [183, 28, 28] },
  { name: '粉色',   hex: '#f8bbd0', rgb: [248, 187, 208] },
  { name: '橙色',   hex: '#fb8c00', rgb: [251, 140, 0] },
  { name: '黄色',   hex: '#fdd835', rgb: [253, 216, 53] },
  { name: '柠檬黄', hex: '#c6ff00', rgb: [198, 255, 0] },
  { name: '绿色',   hex: '#43a047', rgb: [67, 160, 71] },
  { name: '深绿',   hex: '#1b5e20', rgb: [27, 94, 32] },
  { name: '浅绿',   hex: '#a5d6a7', rgb: [165, 214, 167] },
  { name: '青色',   hex: '#00acc1', rgb: [0, 172, 193] },
  { name: '天蓝',   hex: '#4fc3f7', rgb: [79, 195, 247] },
  { name: '蓝色',   hex: '#1e88e5', rgb: [30, 136, 229] },
  { name: '深蓝',   hex: '#0d47a1', rgb: [13, 71, 161] },
  { name: '紫色',   hex: '#8e24aa', rgb: [142, 36, 170] },
  { name: '浅紫',   hex: '#ce93d8', rgb: [206, 147, 216] },
  { name: '棕色',   hex: '#6d4c41', rgb: [109, 76, 65] },
  { name: '浅棕',   hex: '#bcaaa4', rgb: [188, 170, 164] },
  { name: '灰色',   hex: '#9e9e9e', rgb: [158, 158, 158] },
  { name: '浅灰',   hex: '#e0e0e0', rgb: [224, 224, 224] },
  { name: '肤色',   hex: '#ffccbc', rgb: [255, 204, 188] },
  { name: '金色',   hex: '#ffb300', rgb: [255, 179, 0] },
  { name: '银色',   hex: '#cfd8dc', rgb: [207, 216, 220] },
]

// 颜色距离（欧氏距离）
const colorDist = (c1, c2) => {
  const dr = c1[0] - c2[0]
  const dg = c1[1] - c2[1]
  const db = c1[2] - c2[2]
  return dr * dr + dg * dg + db * db
}

// 将颜色匹配到最近的色板颜色
const matchColor = (rgb) => {
  let minIdx = 0
  let minDist = Infinity
  for (let i = 0; i < BEAD_PALETTE.length; i++) {
    const d = colorDist(rgb, BEAD_PALETTE[i].rgb)
    if (d < minDist) { minDist = d; minIdx = i }
  }
  return minIdx
}

// 生成默认爱心图片（绘制到离屏 canvas）
const generateHeartImage = () => {
  const size = 48
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  // 背景透明
  ctx.clearRect(0, 0, size, size)
  // 绘制爱心
  ctx.fillStyle = '#e53935'
  const cx = size / 2
  const cy = size / 2 + 2
  // 用两个圆 + 一个三角组成爱心
  ctx.beginPath()
  ctx.arc(cx - 8, cy - 6, 9, 0, Math.PI * 2)
  ctx.arc(cx + 8, cy - 6, 9, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx - 16, cy - 2)
  ctx.lineTo(cx, cy + 16)
  ctx.lineTo(cx + 16, cy - 2)
  ctx.closePath()
  ctx.fill()
  // 高光
  ctx.fillStyle = '#ef9a9a'
  ctx.beginPath()
  ctx.arc(cx - 10, cy - 9, 3, 0, Math.PI * 2)
  ctx.fill()
  return canvas
}

/** 拼豆图纸生成器页面 */
export default function PixelBeadsPage() {
  const [gridSize, setGridSize] = useState(48)
  const [colorCount, setColorCount] = useState(12) // 颜色精简度
  const [imageLoaded, setImageLoaded] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [beadCounts, setBeadCounts] = useState([]) // [{name, hex, count}]

  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const sourceImgRef = useRef(null) // 原始图片

  const BEAD_SIZE = 20 // 每颗珠子在画布上的像素大小

  // 颜色量化：将颜色减少到 colorCount 种
  const quantizeColor = useCallback((rgb) => {
    // 根据 colorCount 计算每个通道的色阶数
    const levels = Math.max(2, Math.ceil(Math.cbrt(colorCount)))
    const step = 255 / (levels - 1)
    const r = Math.round(Math.round(rgb[0] / step) * step)
    const g = Math.round(Math.round(rgb[1] / step) * step)
    const b = Math.round(Math.round(rgb[2] / step) * step)
    return [r, g, b]
  }, [colorCount])

  // 核心：像素化图片并渲染
  const pixelate = useCallback((img) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const size = gridSize
    canvas.width = size * BEAD_SIZE
    canvas.height = size * BEAD_SIZE
    const ctx = canvas.getContext('2d')

    // 1. 将图片绘制到小尺寸 canvas（降采样）
    const small = document.createElement('canvas')
    small.width = size
    small.height = size
    const sctx = small.getContext('2d')
    sctx.imageSmoothingEnabled = true
    sctx.imageSmoothingQuality = 'high'

    // 等比例居中裁剪绘制
    const imgRatio = img.width / img.height
    const drawSize = size
    let sx = 0, sy = 0, sw = img.width, sh = img.height
    if (imgRatio > 1) {
      sw = img.height
      sx = (img.width - sw) / 2
    } else {
      sh = img.width
      sy = (img.height - sh) / 2
    }
    sctx.drawImage(img, sx, sy, sw, sh, 0, 0, drawSize, drawSize)

    // 2. 读取像素数据并量化
    const imgData = sctx.getImageData(0, 0, size, size)
    const data = imgData.data
    const counts = new Array(BEAD_PALETTE.length).fill(0)

    // 3. 绘制每颗珠子
    ctx.fillStyle = '#fafafa'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4
        const a = data[i + 3]
        if (a < 128) continue // 透明像素跳过
        const rgb = [data[i], data[i + 1], data[i + 2]]
        const quantized = quantizeColor(rgb)
        const idx = matchColor(quantized)
        counts[idx]++

        const bead = BEAD_PALETTE[idx]
        const px = x * BEAD_SIZE
        const py = y * BEAD_SIZE
        const r = BEAD_SIZE / 2 - 1

        // 珠子底色
        ctx.fillStyle = bead.hex
        ctx.beginPath()
        ctx.arc(px + BEAD_SIZE / 2, py + BEAD_SIZE / 2, r, 0, Math.PI * 2)
        ctx.fill()

        // 珠子高光（立体感）
        const grad = ctx.createRadialGradient(
          px + BEAD_SIZE / 2 - 2, py + BEAD_SIZE / 2 - 2, 1,
          px + BEAD_SIZE / 2, py + BEAD_SIZE / 2, r
        )
        grad.addColorStop(0, 'rgba(255,255,255,0.35)')
        grad.addColorStop(0.5, 'rgba(255,255,255,0)')
        grad.addColorStop(1, 'rgba(0,0,0,0.15)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(px + BEAD_SIZE / 2, py + BEAD_SIZE / 2, r, 0, Math.PI * 2)
        ctx.fill()

        // 珠子中心小孔
        ctx.fillStyle = 'rgba(0,0,0,0.15)'
        ctx.beginPath()
        ctx.arc(px + BEAD_SIZE / 2, py + BEAD_SIZE / 2, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // 4. 绘制网格线
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= size; i++) {
      ctx.beginPath()
      ctx.moveTo(i * BEAD_SIZE, 0)
      ctx.lineTo(i * BEAD_SIZE, size * BEAD_SIZE)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i * BEAD_SIZE)
      ctx.lineTo(size * BEAD_SIZE, i * BEAD_SIZE)
      ctx.stroke()
    }

    // 5. 更新珠子计数
    const list = []
    for (let i = 0; i < BEAD_PALETTE.length; i++) {
      if (counts[i] > 0) {
        list.push({ ...BEAD_PALETTE[i], count: counts[i] })
      }
    }
    list.sort((a, b) => b.count - a.count)
    setBeadCounts(list)
  }, [gridSize, quantizeColor])

  // 加载图片
  const loadImage = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      sourceImgRef.current = img
      setImageLoaded(true)
      pixelate(img)
      URL.revokeObjectURL(url)
    }
    img.onerror = () => { URL.revokeObjectURL(url); alert('图片加载失败') }
    img.src = url
  }, [pixelate])

  // 加载默认爱心图片
  useEffect(() => {
    const heart = generateHeartImage()
    const img = new Image()
    img.onload = () => {
      sourceImgRef.current = img
      pixelate(img)
    }
    img.src = heart.toDataURL()
  }, [pixelate])

  // 当 gridSize 或 colorCount 变化时重新像素化
  useEffect(() => {
    if (sourceImgRef.current) {
      pixelate(sourceImgRef.current)
    }
  }, [gridSize, colorCount, pixelate])

  const handleFileInput = (e) => {
    const file = e.target.files?.[0]
    if (file) loadImage(file)
    e.target.value = ''
  }

  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragOver(false) }
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) loadImage(file)
  }

  // 导出高清打印底稿
  const handleExport = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const beadCanvas = canvas

    // 创建导出画布：图纸 + 计数清单
    const padding = 40
    const titleH = 60
    const listW = 280
    const totalW = beadCanvas.width + listW + padding * 3
    const totalH = Math.max(beadCanvas.height + titleH + padding * 2, 400)

    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = totalW
    exportCanvas.height = totalH
    const ectx = exportCanvas.getContext('2d')

    // 背景
    ectx.fillStyle = '#ffffff'
    ectx.fillRect(0, 0, totalW, totalH)

    // 标题
    ectx.fillStyle = '#1a1a1a'
    ectx.font = 'bold 28px sans-serif'
    ectx.textAlign = 'left'
    ectx.fillText('✨ 拼豆图纸', padding, 42)
    ectx.font = '14px sans-serif'
    ectx.fillStyle = '#666'
    ectx.fillText(`${gridSize} × ${gridSize} 格 · ${beadCounts.length} 种颜色`, padding, 64)

    // 图纸
    ectx.drawImage(beadCanvas, padding, titleH + padding)

    // 珠子计数清单
    let ly = titleH + padding + 10
    ectx.fillStyle = '#1a1a1a'
    ectx.font = 'bold 18px sans-serif'
    ectx.fillText('珠子计数清单', beadCanvas.width + padding * 2, ly)
    ly += 30

    beadCounts.forEach((bead, i) => {
      const cx = beadCanvas.width + padding * 2
      // 颜色圆点
      ectx.fillStyle = bead.hex
      ectx.beginPath()
      ectx.arc(cx + 12, ly - 6, 10, 0, Math.PI * 2)
      ectx.fill()
      ectx.strokeStyle = '#ccc'
      ectx.lineWidth = 1
      ectx.stroke()
      // 文字
      ectx.fillStyle = '#333'
      ectx.font = '14px sans-serif'
      ectx.fillText(`${bead.name} × ${bead.count}颗`, cx + 30, ly - 1)
      ly += 28
      if (ly > totalH - 40) return
    })

    // 底部总颗数
    const total = beadCounts.reduce((s, b) => s + b.count, 0)
    ectx.fillStyle = '#e53935'
    ectx.font = 'bold 15px sans-serif'
    ectx.fillText(`合计：${total} 颗`, beadCanvas.width + padding * 2, ly + 10)

    // 导出
    exportCanvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pixel-beads-${gridSize}x${gridSize}-${Date.now()}.png`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png', 1.0)
  }

  const totalBeads = useMemo(() => beadCounts.reduce((s, b) => s + b.count, 0), [beadCounts])

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col">
      <main className="flex-1 px-4 py-6">
        <div className="max-w-6xl mx-auto">
          {/* 顶部导航栏 */}
          <div className="flex items-center justify-between mb-6">
            <BackButton />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              ✨ 闪电拼豆图纸生成器
            </h1>
            <div className="w-24" />
          </div>

          {/* 副标题 */}
          <p className="text-center text-gray-500 text-sm mb-6">
            100%免费、免下载、本地保护隐私
          </p>

          {/* 双栏布局 */}
          <div className="grid lg:grid-cols-[360px_1fr] gap-6">
            {/* 左侧控制面板 */}
            <div className="space-y-4">
              {/* 上传区 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">📷 上传图片</h2>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                    isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-4xl mb-2">🖼️</div>
                  <p className="text-sm font-medium text-gray-700">拖入你的头像或宠物照片</p>
                  <p className="text-xs text-gray-400 mt-1">或点击此处选择文件（JPG / PNG）</p>
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleFileInput} className="hidden" />
                </div>
                {imageLoaded && (
                  <p className="mt-2 text-xs text-green-600 text-center">✅ 图片已加载，可调节下方参数</p>
                )}
              </div>

              {/* 画布大小 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">📐 拼豆画布大小（难度）</h2>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { size: 24, label: '24×24', sub: '简单' },
                    { size: 48, label: '48×48', sub: '中等' },
                    { size: 72, label: '72×72', sub: '挑战' },
                  ].map((opt) => (
                    <button
                      key={opt.size}
                      onClick={() => setGridSize(opt.size)}
                      className={`rounded-xl py-3 px-2 text-center transition-all ${
                        gridSize === opt.size
                          ? 'bg-blue-500 text-white shadow-sm active:scale-95'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <div className="text-sm font-semibold">{opt.label}</div>
                      <div className={`text-xs ${gridSize === opt.size ? 'text-blue-100' : 'text-gray-400'}`}>{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 颜色精简度 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-700">🎨 颜色精简度</h2>
                  <span className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">{colorCount} 色</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={24}
                  value={colorCount}
                  onChange={(e) => setColorCount(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>简洁</span>
                  <span>丰富</span>
                </div>
              </div>

              {/* Amazon 联盟卡片 */}
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="block bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-4 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl">🛒</div>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      💡 还没有原材料？
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      点击这里一键采购【高品质 2.6mm 拼豆 24色全套工具包】
                    </p>
                  </div>
                </div>
              </a>
            </div>

            {/* 右侧预览与下载区 */}
            <div className="space-y-4">
              {/* 预览画布 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">👀 实时预览</h2>
                <div className="flex justify-center bg-gray-50 rounded-xl p-4 overflow-auto">
                  <canvas
                    ref={canvasRef}
                    className="max-w-full h-auto rounded-lg"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>
              </div>

              {/* 珠子计数清单 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-700">🧮 珠子计数清单</h2>
                  <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                    合计 {totalBeads} 颗
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {beadCounts.length === 0 ? (
                    <p className="text-sm text-gray-400">暂无数据</p>
                  ) : (
                    beadCounts.map((bead, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-gray-50 rounded-full px-2.5 py-1">
                        <span
                          className="w-4 h-4 rounded-full border border-gray-200"
                          style={{ backgroundColor: bead.hex }}
                        />
                        <span className="text-xs text-gray-600">{bead.name}</span>
                        <span className="text-xs font-semibold text-gray-800">×{bead.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 下载按钮 */}
              <button
                onClick={handleExport}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold bg-green-500 text-white hover:bg-green-600 active:scale-[0.98] transition-all shadow-lg shadow-green-500/20"
              >
                📥 一键导出高清打印底稿
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
