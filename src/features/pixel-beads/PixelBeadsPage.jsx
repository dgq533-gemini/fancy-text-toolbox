import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import BackButton from '../../components/BackButton'
import Footer from '../../components/Footer'
import { pixelateImage, getPalette } from './beadAlgorithm'

const BEAD_SIZE = 14
const MAX_RENDER_SCALE = 3 // canvas 最大渲染倍率（防止内存爆炸）
const BASE_SCALE = 2 // 基础渲染分辨率倍率，缩放时不重绘，仅改 CSS 尺寸

// 根据长边格数 + 图片比例计算 cols × rows
const calcGrid = (img, longSide) => {
  const ratio = img.width / img.height
  let cols, rows
  if (ratio >= 1) {
    cols = longSide
    rows = Math.max(8, Math.round(longSide / ratio))
  } else {
    rows = longSide
    cols = Math.max(8, Math.round(longSide * ratio))
  }
  return { cols, rows }
}

// 根据图片颜色丰富度推荐颜色精简度
const analyzeColors = (img) => {
  const sample = 64
  const c = document.createElement('canvas')
  c.width = sample; c.height = sample
  const ctx = c.getContext('2d')
  const ratio = img.width / img.height
  let dw, dh, dx, dy
  if (ratio >= 1) { dw = sample; dh = sample / ratio; dx = 0; dy = (sample - dh) / 2 }
  else { dh = sample; dw = sample * ratio; dy = 0; dx = (sample - dw) / 2 }
  ctx.drawImage(img, dx, dy, dw, dh)
  const data = ctx.getImageData(0, 0, sample, sample).data
  const set = new Set()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    set.add(`${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`)
  }
  // 返回图片实际颜色数（clamp 到 1~291），与原材料清单颜色种类联动
  return Math.min(291, Math.max(1, set.size))
}

// 生成默认金毛图片
const generateGoldenRetriever = () => {
  const w = 96, h = 80
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, w, h)

  const gold = '#e0a854', darkGold = '#b8863a', lightGold = '#f0c878'
  const brown = '#6d4c41', white = '#fafafa', black = '#1a1a1a', pink = '#f8bbd0'

  ctx.fillStyle = gold
  ctx.beginPath(); ctx.ellipse(w / 2, h / 2 + 8, 28, 22, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = white
  ctx.beginPath(); ctx.ellipse(w / 2, h / 2 + 14, 16, 12, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = gold
  ctx.beginPath(); ctx.ellipse(w / 2, 26, 20, 18, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = darkGold
  ctx.beginPath(); ctx.ellipse(w / 2 - 18, 28, 7, 14, 0.3, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.ellipse(w / 2 + 18, 28, 7, 14, -0.3, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = lightGold
  ctx.beginPath(); ctx.ellipse(w / 2, 30, 10, 8, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = black
  ctx.beginPath(); ctx.arc(w / 2 - 7, 24, 2.5, 0, Math.PI * 2); ctx.arc(w / 2 + 7, 24, 2.5, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = white
  ctx.beginPath(); ctx.arc(w / 2 - 6.5, 23.5, 0.8, 0, Math.PI * 2); ctx.arc(w / 2 + 7.5, 23.5, 0.8, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = black
  ctx.beginPath(); ctx.ellipse(w / 2, 31, 2.5, 2, 0, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = brown; ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(w / 2, 33); ctx.lineTo(w / 2, 35)
  ctx.moveTo(w / 2, 35); ctx.quadraticCurveTo(w / 2 - 3, 37, w / 2 - 4, 36)
  ctx.moveTo(w / 2, 35); ctx.quadraticCurveTo(w / 2 + 3, 37, w / 2 + 4, 36)
  ctx.stroke()
  ctx.fillStyle = pink
  ctx.beginPath(); ctx.ellipse(w / 2, 37, 2, 1.5, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = gold
  ctx.fillRect(w / 2 - 14, h / 2 + 18, 6, 14)
  ctx.fillRect(w / 2 + 8, h / 2 + 18, 6, 14)
  ctx.fillStyle = lightGold
  ctx.fillRect(w / 2 - 14, h / 2 + 28, 6, 4)
  ctx.fillRect(w / 2 + 8, h / 2 + 28, 6, 4)
  ctx.fillStyle = gold
  ctx.beginPath(); ctx.ellipse(w / 2 + 26, h / 2 - 2, 8, 5, 0.5, 0, Math.PI * 2); ctx.fill()

  return canvas
}

const getDifficultyLabel = (longSide) => {
  if (longSide <= 100) return { label: '简单', color: 'text-green-600', bg: 'bg-green-50' }
  if (longSide <= 200) return { label: '中等', color: 'text-amber-600', bg: 'bg-amber-50' }
  return { label: '挑战', color: 'text-red-600', bg: 'bg-red-50' }
}

/** 拼豆图纸生成器 */
export default function PixelBeadsPage() {
  const [longSide, setLongSide] = useState(175)
  const [grid, setGrid] = useState({ cols: 48, rows: 40 })
  const [colorCount, setColorCount] = useState(291)
  const [mergeThreshold, setMergeThreshold] = useState(10) // 颜色合并阈值 0~100，默认10
  const [mode, setMode] = useState('average')
  const [isDragOver, setIsDragOver] = useState(false)
  const [beadCounts, setBeadCounts] = useState([])
  const [originalSrc, setOriginalSrc] = useState('')
  const [isDefault, setIsDefault] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // 数值输入框的显示值（允许空字符串，blur 时再校验）
  const [longSideInput, setLongSideInput] = useState('175')
  const [colorCountInput, setColorCountInput] = useState('291')
  const [mergeThresholdInput, setMergeThresholdInput] = useState('10')

  const previewCanvasRef = useRef(null)
  const sourceCanvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const sourceImgRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const dragRef = useRef({ startX: 0, startY: 0, ox: 0, oy: 0 })
  const touchRef = useRef({ mode: null, dist: 0, startZoom: 1, startX: 0, startY: 0, ox: 0, oy: 0, cx: 0, cy: 0 })
  const fitTimerRef = useRef(null)

  // 计算 beadGrid（不依赖 zoom，参数变化时自动重算）
  const beadResult = useMemo(() => {
    const sourceCanvas = sourceCanvasRef.current
    if (!sourceCanvas || !sourceImgRef.current) return { grid: [], counts: new Map() }
    const sctx = sourceCanvas.getContext('2d')
    // 滑块 0~100 映射到 OKLab 距离阈值 0~0.5
    const threshold = (mergeThreshold / 100) * 0.5
    // 有合并阈值时不限制颜色数量（让阈值合并主导），否则用 colorCount 限制
    const effectiveMaxColors = mergeThreshold > 0 ? 291 : colorCount
    return pixelateImage(sctx, sourceCanvas.width, sourceCanvas.height, grid.cols, grid.rows, mode, effectiveMaxColors, threshold)
  }, [grid, mode, colorCount, mergeThreshold])

  // 同步数值显示值（滑块/外部变化时更新输入框）
  useEffect(() => { setLongSideInput(String(longSide)) }, [longSide])
  useEffect(() => { setColorCountInput(String(colorCount)) }, [colorCount])
  useEffect(() => { setMergeThresholdInput(String(mergeThreshold)) }, [mergeThreshold])

  // 渲染画布（仅依赖 beadResult + grid，不依赖 zoom；zoom 变化只改 CSS 尺寸）
  const renderCanvas = useCallback(() => {
    const canvas = previewCanvasRef.current
    if (!canvas || !beadResult.grid.length) return
    const { cols, rows } = grid
    const beadGrid = beadResult.grid

    // 固定 BASE_SCALE 分辨率渲染，缩放时不重绘
    canvas.width = Math.round(cols * BEAD_SIZE * BASE_SCALE)
    canvas.height = Math.round(rows * BEAD_SIZE * BASE_SCALE)

    const ctx = canvas.getContext('2d')
    ctx.setTransform(BASE_SCALE, 0, 0, BASE_SCALE, 0, 0)
    ctx.imageSmoothingEnabled = true

    ctx.fillStyle = '#f5f5f5'
    ctx.fillRect(0, 0, cols * BEAD_SIZE, rows * BEAD_SIZE)

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = beadGrid[y][x]
        if (!cell) continue
        const px = x * BEAD_SIZE, py = y * BEAD_SIZE
        const r = BEAD_SIZE / 2 - 1

        ctx.fillStyle = cell.hex
        ctx.beginPath()
        ctx.arc(px + BEAD_SIZE / 2, py + BEAD_SIZE / 2, r, 0, Math.PI * 2)
        ctx.fill()

        const grad = ctx.createRadialGradient(
          px + BEAD_SIZE / 2 - 2, py + BEAD_SIZE / 2 - 2, 1,
          px + BEAD_SIZE / 2, py + BEAD_SIZE / 2, r
        )
        grad.addColorStop(0, 'rgba(255,255,255,0.4)')
        grad.addColorStop(0.5, 'rgba(255,255,255,0)')
        grad.addColorStop(1, 'rgba(0,0,0,0.12)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(px + BEAD_SIZE / 2, py + BEAD_SIZE / 2, r, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = 'rgba(0,0,0,0.18)'
        ctx.beginPath()
        ctx.arc(px + BEAD_SIZE / 2, py + BEAD_SIZE / 2, 1.8, 0, Math.PI * 2)
        ctx.fill()

        const luminance = (cell.rgb.r * 299 + cell.rgb.g * 587 + cell.rgb.b * 114) / 1000
        ctx.fillStyle = luminance > 140 ? '#000000' : '#ffffff'
        ctx.font = `${Math.max(5, Math.round(BEAD_SIZE * 0.38))}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(cell.name, px + BEAD_SIZE / 2, py + BEAD_SIZE / 2)
      }
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.07)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= cols; i++) {
      ctx.beginPath(); ctx.moveTo(i * BEAD_SIZE, 0); ctx.lineTo(i * BEAD_SIZE, rows * BEAD_SIZE); ctx.stroke()
    }
    for (let i = 0; i <= rows; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * BEAD_SIZE); ctx.lineTo(cols * BEAD_SIZE, i * BEAD_SIZE); ctx.stroke()
    }

    // 珠子计数
    const list = []
    beadResult.counts.forEach((count, hex) => {
      const p = getPalette().find((c) => c.hex === hex)
      if (p) list.push({ color: p, count })
    })
    list.sort((a, b) => b.count - a.count)
    setBeadCounts(list)
  }, [beadResult, grid])

  // 颜色精简度与实际使用颜色数联动（colorCount 大于实际颜色数时自动同步）
  useEffect(() => {
    if (beadCounts.length > 0) {
      setColorCount((cc) => (cc > beadCounts.length ? beadCounts.length : cc))
    }
  }, [beadCounts])

  // 缩放时仅更新 canvas CSS 显示尺寸（不重绘，极速）
  useEffect(() => {
    const canvas = previewCanvasRef.current
    if (!canvas) return
    const { cols, rows } = grid
    canvas.style.width = `${cols * BEAD_SIZE * zoom}px`
    canvas.style.height = `${rows * BEAD_SIZE * zoom}px`
  }, [zoom, grid])

  // 自动适配容器：居中显示全部，尽量填满去白边
  const fitToScreen = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const { cols, rows } = grid
    const availW = container.clientWidth
    const availH = container.clientHeight
    const contentW = cols * BEAD_SIZE
    const contentH = rows * BEAD_SIZE
    if (contentW <= 0 || contentH <= 0) return
    // 取较小比例保证完整显示，图片居中，白边最小
    const z = Math.min(availW / contentW, availH / contentH)
    setZoom(+z.toFixed(4))
    setOffsetX(0)
    setOffsetY(0)
  }, [grid])

  // 用 ref 保存最新 renderCanvas，避免 effect 依赖它导致循环
  const renderCanvasRef = useRef(null)
  useEffect(() => { renderCanvasRef.current = renderCanvas }, [renderCanvas])

  // 图纸更新（beadResult 变化）→ 渲染 + 自动适配
  useEffect(() => {
    if (beadResult.grid.length > 0) {
      renderCanvasRef.current?.()
      if (fitTimerRef.current) clearTimeout(fitTimerRef.current)
      fitTimerRef.current = setTimeout(() => fitToScreen(), 50)
    }
    return () => { if (fitTimerRef.current) clearTimeout(fitTimerRef.current) }
  }, [beadResult, fitToScreen])

  // 加载图片
  const loadImage = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      sourceImgRef.current = img
      setOriginalSrc(url)
      setIsDefault(false)
      const defaultLongSide = 175
      setLongSide(defaultLongSide)
      setGrid(calcGrid(img, defaultLongSide))
      setColorCount(analyzeColors(img))
      const sc = sourceCanvasRef.current
      if (sc) {
        sc.width = img.width
        sc.height = img.height
        sc.getContext('2d').drawImage(img, 0, 0)
      }
    }
    img.onerror = () => { URL.revokeObjectURL(url); alert('图片加载失败') }
    img.src = url
  }, [])

  // 默认加载金毛
  useEffect(() => {
    const def = generateGoldenRetriever()
    const img = new Image()
    img.onload = () => {
      sourceImgRef.current = img
      setOriginalSrc(def.toDataURL())
      const defaultLongSide = 175
      setLongSide(defaultLongSide)
      setGrid(calcGrid(img, defaultLongSide))
      setColorCount(analyzeColors(img))
      const sc = sourceCanvasRef.current
      if (sc) {
        sc.width = img.width
        sc.height = img.height
        sc.getContext('2d').drawImage(img, 0, 0)
      }
    }
    img.src = def.toDataURL()
  }, [])

  // 长边滑块变化
  const handleLongSideChange = (val) => {
    setLongSide(val)
    if (sourceImgRef.current) {
      setGrid(calcGrid(sourceImgRef.current, val))
    }
  }

  // 颜色合并阈值变化：归零时临时解除颜色数量限制，让颜色恢复
  const handleMergeThresholdChange = (val) => {
    setMergeThreshold(val)
    if (val === 0) setColorCount(291)
  }

  // 鼠标滚轮缩放（以鼠标位置为中心）
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const container = scrollContainerRef.current
    const rect = container.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    setZoom((z) => {
      const newZoom = Math.min(5, Math.max(0.1, +(z * factor).toFixed(3)))
      // 以鼠标位置为中心缩放
      const ratio = newZoom / z
      setOffsetX((ox) => mx - (mx - ox) * ratio)
      setOffsetY((oy) => my - (my - oy) * ratio)
      return newZoom
    })
  }, [])

  // 鼠标拖拽
  const handleMouseDown = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    setIsDragging(true)
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: offsetX, oy: offsetY }
  }
  const handleMouseMove = (e) => {
    if (!isDragging) return
    setOffsetX(dragRef.current.ox + (e.clientX - dragRef.current.startX))
    setOffsetY(dragRef.current.oy + (e.clientY - dragRef.current.startY))
  }
  const handleMouseUp = () => setIsDragging(false)
  // 补充：鼠标移出窗口时仍能结束拖拽
  useEffect(() => {
    if (!isDragging) return
    const onUp = () => setIsDragging(false)
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [isDragging])

  // 触屏：单指拖拽 + 双指缩放
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      touchRef.current = {
        mode: 'drag',
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        ox: offsetX, oy: offsetY,
      }
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const container = scrollContainerRef.current
      const rect = container.getBoundingClientRect()
      touchRef.current = {
        mode: 'pinch',
        dist: Math.hypot(dx, dy),
        startZoom: zoom,
        cx: (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left,
        cy: (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top,
        ox: offsetX, oy: offsetY,
      }
    }
  }
  const handleTouchMove = (e) => {
    e.preventDefault()
    const t = touchRef.current
    if (t.mode === 'drag' && e.touches.length === 1) {
      setOffsetX(t.ox + (e.touches[0].clientX - t.startX))
      setOffsetY(t.oy + (e.touches[0].clientY - t.startY))
    } else if (t.mode === 'pinch' && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      const newZoom = Math.min(5, Math.max(0.1, +(t.startZoom * (dist / t.dist)).toFixed(3)))
      const ratio = newZoom / t.startZoom
      setZoom(newZoom)
      setOffsetX(t.cx - (t.cx - t.ox) * ratio)
      setOffsetY(t.cy - (t.cy - t.oy) * ratio)
    }
  }
  const handleTouchEnd = () => { touchRef.current.mode = null }

  // 键盘缩放
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return
      if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(5, +(z + 0.1).toFixed(2)))
      } else if (e.key === '-') {
        setZoom((z) => Math.max(0.1, +(z - 0.1).toFixed(2)))
      } else if (e.key === '0') {
        fitToScreen()
      } else if (e.key === 'f' || e.key === 'F') {
        fitToScreen()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fitToScreen])

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

  // 导出高清合并 PNG
  const handleExport = () => {
    const beadCanvas = previewCanvasRef.current
    if (!beadCanvas) return
    // 导出时用 1:1 原始尺寸渲染（不缩放）
    const { cols, rows } = grid
    const padding = 40, titleH = 60, listW = 300
    const totalW = beadCanvas.width + listW + padding * 3
    const totalH = Math.max(beadCanvas.height + titleH + padding * 2, 420)

    const ec = document.createElement('canvas')
    ec.width = totalW; ec.height = totalH
    const ectx = ec.getContext('2d')
    ectx.fillStyle = '#ffffff'; ectx.fillRect(0, 0, totalW, totalH)

    ectx.fillStyle = '#1a1a1a'; ectx.font = 'bold 28px sans-serif'; ectx.textAlign = 'left'
    ectx.fillText('✨ 拼豆图纸', padding, 42)
    ectx.font = '14px sans-serif'; ectx.fillStyle = '#666'
    ectx.fillText(`${cols} × ${rows} 格 · ${beadCounts.length} 种颜色`, padding, 64)
    ectx.drawImage(beadCanvas, padding, titleH + padding)

    let ly = titleH + padding + 10
    ectx.fillStyle = '#1a1a1a'; ectx.font = 'bold 18px sans-serif'
    ectx.fillText('珠子计数清单', beadCanvas.width + padding * 2, ly)
    ly += 32
    beadCounts.forEach(({ color, count }) => {
      const cx = beadCanvas.width + padding * 2
      ectx.fillStyle = color.hex
      ectx.beginPath(); ectx.arc(cx + 12, ly - 6, 10, 0, Math.PI * 2); ectx.fill()
      ectx.strokeStyle = '#ccc'; ectx.lineWidth = 1; ectx.stroke()
      ectx.fillStyle = '#333'; ectx.font = '14px sans-serif'
      ectx.fillText(`${color.name} × ${count}颗`, cx + 30, ly - 1)
      ly += 28
      if (ly > totalH - 50) return
    })
    const total = beadCounts.reduce((s, b) => s + b.count, 0)
    ectx.fillStyle = '#e53935'; ectx.font = 'bold 15px sans-serif'
    ectx.fillText(`合计：${total} 颗`, beadCanvas.width + padding * 2, ly + 12)

    ec.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pixel-beads-${cols}x${rows}-${Date.now()}.png`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png', 1.0)
  }

  const totalBeads = useMemo(() => beadCounts.reduce((s, b) => s + b.count, 0), [beadCounts])
  const diffInfo = getDifficultyLabel(longSide)
  const contentW = grid.cols * BEAD_SIZE * zoom
  const contentH = grid.rows * BEAD_SIZE * zoom

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col">
      <canvas ref={sourceCanvasRef} className="hidden" />

      <main className="flex-1 px-4 py-6">
        <div className="max-w-7xl mx-auto">
          {/* 顶部导航 */}
          <div className="flex items-center justify-between mb-4">
            <BackButton />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              ✨ 拼豆图纸生成器
            </h1>
            <div className="w-24" />
          </div>

          {/* 步骤引导 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {[
                { num: 1, text: '上传图片', icon: '📷' },
                { num: 2, text: '选择格子数', icon: '📐' },
                { num: 3, text: '调整颜色', icon: '🎨' },
                { num: 4, text: '导出底稿', icon: '📥' },
              ].map((step, i) => (
                <div key={step.num} className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-blue-50 rounded-full px-3 py-1.5">
                    <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">
                      {step.num}
                    </span>
                    <span className="text-sm text-blue-700 font-medium whitespace-nowrap">
                      {step.icon} {step.text}
                    </span>
                  </div>
                  {i < 3 && (
                    <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 两栏布局 */}
          <div className="grid md:grid-cols-[340px_1fr] gap-5">
            {/* 左区：控制台 */}
            <div className="space-y-4">
              {/* 上传区 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`rounded-2xl border-2 border-dashed p-4 text-center cursor-pointer transition-all ${
                    isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                  }`}
                >
                  {originalSrc ? (
                    <div className="flex flex-col items-center">
                      <img
                        src={originalSrc}
                        alt="已上传图片"
                        className="max-w-full max-h-44 object-contain rounded-lg border border-gray-200 mb-2"
                      />
                      <p className="text-xs font-medium text-gray-700">
                        {isDefault ? '示例金毛图' : '已上传图片'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">点击更换图片</p>
                    </div>
                  ) : (
                    <>
                      <div className="text-5xl mb-3">🖼️</div>
                      <p className="text-base font-semibold text-gray-700">1. 拖入或点击上传图片</p>
                      <p className="text-xs text-gray-400 mt-1">支持 JPG / PNG / GIF</p>
                    </>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/gif" onChange={handleFileInput} className="hidden" />
                </div>
                {isDefault && (
                  <p className="mt-2 text-xs text-amber-600 text-center">🐕 当前为示例金毛图，上传后自动替换</p>
                )}
              </div>

              {/* 格子数滑块 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-700">2. 拼豆底板大小</h2>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${diffInfo.bg} ${diffInfo.color}`}>
                      {diffInfo.label}
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={longSideInput}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '')
                        setLongSideInput(v)
                        if (v) handleLongSideChange(Math.min(300, Math.max(50, parseInt(v))))
                      }}
                      onBlur={() => { if (!longSideInput) setLongSideInput(String(longSide)) }}
                      className={`w-14 text-center text-xs font-bold rounded-full px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-amber-300 ${diffInfo.bg} ${diffInfo.color}`}
                    />
                    <span className={`text-xs font-bold ${diffInfo.color}`}>格</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={50}
                  max={300}
                  value={longSide}
                  onChange={(e) => handleLongSideChange(Number(e.target.value))}
                  className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: 'linear-gradient(to right, #22c55e 0%, #22c55e 33%, #eab308 33%, #eab308 66%, #ef4444 66%, #ef4444 100%)',
                  }}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span className="text-green-600">50 简单</span>
                  <span className="text-amber-600">175 中等</span>
                  <span className="text-red-600">300 挑战</span>
                </div>
                <p className="mt-2 text-xs text-gray-400">当前画布：{grid.cols}×{grid.rows} 格（按原图比例适配）</p>
              </div>

              {/* 颜色精简度 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-700">3. 颜色精简度</h2>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={colorCountInput}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '')
                        setColorCountInput(v)
                        if (v) setColorCount(Math.min(291, Math.max(1, parseInt(v))))
                      }}
                      onBlur={() => { if (!colorCountInput) setColorCountInput(String(colorCount)) }}
                      className="w-12 text-center text-xs font-bold text-blue-500 bg-blue-50 rounded-full px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <span className="text-xs font-bold text-blue-500">色</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={1}
                  max={291}
                  value={colorCount}
                  onChange={(e) => setColorCount(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>← 少色</span>
                  <span>全色(291) →</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">已根据图片自动推荐</p>
              </div>

              {/* 颜色合并阈值 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-700">颜色合并阈值</h2>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={mergeThresholdInput}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '')
                      setMergeThresholdInput(v)
                      if (v) handleMergeThresholdChange(Math.min(100, Math.max(0, parseInt(v))))
                    }}
                    onBlur={() => { if (!mergeThresholdInput) setMergeThresholdInput(String(mergeThreshold)) }}
                    className="w-12 text-center text-xs font-bold text-teal-600 bg-teal-50 rounded-full px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-teal-300"
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={mergeThreshold}
                  onChange={(e) => handleMergeThresholdChange(Number(e.target.value))}
                  className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: 'linear-gradient(to right, #99f6e4 0%, #14b8a6 50%, #0f766e 100%)',
                  }}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0 不合并</span>
                  <span>50 适中</span>
                  <span>100 大幅合并</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">相似颜色自动合并，值越大颜色种类越少</p>
              </div>

              {/* 像素化模式（已隐藏，默认使用真实/平均色） */}
              <div className="hidden">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">像素化模式</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMode('average')}
                    className={`flex-1 rounded-full py-2 text-xs font-medium transition-all ${
                      mode === 'average' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    真实（平均色）
                  </button>
                  <button
                    onClick={() => setMode('dominant')}
                    className={`flex-1 rounded-full py-2 text-xs font-medium transition-all ${
                      mode === 'dominant' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    卡通（主色）
                  </button>
                </div>
              </div>

              {/* 导出按钮 */}
              <button
                onClick={handleExport}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold bg-green-500 text-white hover:bg-green-600 active:scale-[0.98] transition-all shadow-lg shadow-green-500/20"
              >
                📥 导出高清打印底稿
              </button>
            </div>

            {/* 右区：拼豆结果 */}
            <div className="space-y-4 min-w-0">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-700">拼豆图纸结果</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{grid.cols}×{grid.rows}</span>
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-1">
                      <button
                        onClick={() => setZoom((z) => Math.max(0.1, +(z - 0.1).toFixed(2)))}
                        className="w-6 h-6 rounded text-gray-600 hover:bg-gray-200 text-sm"
                      >−</button>
                      <span className="text-xs text-gray-600 w-10 text-center">{Math.round(zoom * 100)}%</span>
                      <button
                        onClick={() => setZoom((z) => Math.min(5, +(z + 0.1).toFixed(2)))}
                        className="w-6 h-6 rounded text-gray-600 hover:bg-gray-200 text-sm"
                      >+</button>
                      <button
                        onClick={fitToScreen}
                        className="w-6 h-6 rounded text-gray-600 hover:bg-gray-200 text-xs"
                        title="适应窗口 (0/F)"
                      >适应</button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-2">
                  💡 滚轮/双指缩放 · 鼠标/单指拖拽 · 0/F 适应窗口 · 放大查看色号
                </p>
                <div
                  ref={scrollContainerRef}
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className="bg-gray-50 rounded-xl p-3 overflow-hidden min-h-[400px] max-h-[70vh] relative select-none"
                  style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
                >
                  <div
                    style={{
                      width: contentW,
                      height: contentH,
                      position: 'absolute',
                      left: `calc(50% + ${offsetX}px)`,
                      top: `calc(50% + ${offsetY}px)`,
                      transform: 'translate(-50%, -50%)',
                      transition: isDragging ? 'none' : 'transform 0.05s linear',
                    }}
                  >
                    <canvas
                      ref={previewCanvasRef}
                      className="rounded-lg"
                      style={{
                        display: 'block',
                        imageRendering: 'auto',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 珠子清单 + Amazon */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-700">🧮 原材料清单</h2>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                        {beadCounts.length} 种颜色
                      </span>
                      <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                        合计 {totalBeads} 颗
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                    {beadCounts.length === 0 ? (
                      <p className="text-sm text-gray-400">暂无</p>
                    ) : (
                      beadCounts.map(({ color, count }, i) => (
                        <div key={i} className="flex items-center gap-1 bg-gray-50 rounded-full px-2 py-0.5">
                          <span className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: color.hex }} />
                          <span className="text-xs text-gray-600">{color.name}</span>
                          <span className="text-xs font-semibold text-gray-800">×{count}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="block bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-4 hover:shadow-md transition-all flex flex-col justify-center"
                >
                  <div className="flex items-start gap-2">
                    <div className="text-2xl">🛒</div>
                    <div>
                      <p className="text-sm font-semibold text-amber-800">购买拼豆原材料</p>
                      <p className="text-xs text-amber-600 mt-1">高品质 2.6mm 拼豆 24色全套工具包</p>
                    </div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
