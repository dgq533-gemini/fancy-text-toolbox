import { BEAD_PALETTE } from './beadPalette'

// 预计算色板的 RGB
const PALETTE = BEAD_PALETTE.map((c) => {
  const r = parseInt(c.hex.slice(1, 3), 16)
  const g = parseInt(c.hex.slice(3, 5), 16)
  const b = parseInt(c.hex.slice(5, 7), 16)
  return { hex: c.hex, name: c.name, rgb: { r, g, b } }
})

// sRGB → Linear
function srgbToLinear(c) {
  const n = c / 255
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
}

// RGB → OKLab
function rgbToOklab(rgb) {
  const r = srgbToLinear(rgb.r)
  const g = srgbToLinear(rgb.g)
  const b = srgbToLinear(rgb.b)
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
  const lr = Math.cbrt(l), mr = Math.cbrt(m), sr = Math.cbrt(s)
  return {
    l: 0.2104542553 * lr + 0.7936177850 * mr - 0.0040720468 * sr,
    a: 1.9779984951 * lr - 2.4285922050 * mr + 0.4505937099 * sr,
    b: 0.0259040371 * lr + 0.7827717662 * mr - 0.8086757660 * sr,
  }
}

// OKLab 缓存
const oklabCache = new Map()
function getOklab(rgb) {
  const key = `${rgb.r},${rgb.g},${rgb.b}`
  const cached = oklabCache.get(key)
  if (cached) return cached
  const o = rgbToOklab(rgb)
  oklabCache.set(key, o)
  return o
}

// OKLab 颜色距离
export function colorDistance(c1, c2) {
  const o1 = getOklab(c1)
  const o2 = getOklab(c2)
  const dl = o1.l - o2.l, da = o1.a - o2.a, db = o1.b - o2.b
  return Math.sqrt(dl * dl + da * da + db * db)
}

// 查找最近色板色
export function findClosestColor(target) {
  let min = Infinity, closest = PALETTE[0]
  for (const p of PALETTE) {
    const d = colorDistance(target, p.rgb)
    if (d < min) { min = d; closest = p }
    if (d === 0) break
  }
  return closest
}

// 按距离阈值合并相似颜色（不常用的合并到最近的常用色）
function mergeByThreshold(grid, threshold) {
  const counts = new Map()
  for (const row of grid) {
    for (const cell of row) {
      if (cell) counts.set(cell.hex, (counts.get(cell.hex) || 0) + 1)
    }
  }
  // 按数量从多到少排序，优先保留常用色
  const colors = Array.from(counts.entries())
    .map(([hex, count]) => {
      const p = PALETTE.find((c) => c.hex === hex)
      return p ? { p, count } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.count - a.count)

  const kept = []
  const mergeMap = new Map()
  for (const { p } of colors) {
    let target = null
    for (const k of kept) {
      if (colorDistance(p.rgb, k.rgb) < threshold) { target = k; break }
    }
    if (target) mergeMap.set(p.hex, target)
    else kept.push(p)
  }

  const newCounts = new Map()
  for (const row of grid) {
    for (let i = 0; i < row.length; i++) {
      const cell = row[i]
      if (cell) {
        const merged = mergeMap.get(cell.hex)
        const final = merged || cell
        row[i] = final
        newCounts.set(final.hex, (newCounts.get(final.hex) || 0) + 1)
      }
    }
  }
  return { grid, counts: newCounts }
}

// 限制颜色数量：合并最不常用的颜色到最近邻居
export function limitColors(grid, maxColors, mergeThreshold = 0) {
  // 先按阈值合并相似颜色
  if (mergeThreshold > 0) {
    const merged = mergeByThreshold(grid, mergeThreshold)
    grid = merged.grid
  }

  const counts = new Map()
  for (const row of grid) {
    for (const cell of row) {
      if (cell) {
        counts.set(cell.hex, (counts.get(cell.hex) || 0) + 1)
      }
    }
  }

  const usedColors = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  if (usedColors.length <= maxColors) {
    return { grid, counts }
  }

  const keepHex = new Set(usedColors.slice(0, maxColors).map(([hex]) => hex))
  const mergeMap = new Map()

  for (const [hex] of usedColors) {
    if (!keepHex.has(hex)) {
      const p = PALETTE.find((c) => c.hex === hex)
      if (p) {
        let nearest = PALETTE[0], minD = Infinity
        for (const keepHexStr of keepHex) {
          const kp = PALETTE.find((c) => c.hex === keepHexStr)
          if (kp) {
            const d = colorDistance(p.rgb, kp.rgb)
            if (d < minD) { minD = d; nearest = kp }
          }
        }
        mergeMap.set(hex, nearest)
      }
    }
  }

  const newCounts = new Map()
  for (const row of grid) {
    for (let i = 0; i < row.length; i++) {
      const cell = row[i]
      if (cell) {
        const merged = mergeMap.get(cell.hex)
        const final = merged || cell
        row[i] = final
        newCounts.set(final.hex, (newCounts.get(final.hex) || 0) + 1)
      }
    }
  }

  return { grid, counts: newCounts }
}

// 计算单元格代表色
function getCellColor(data, imgWidth, startX, startY, w, h, mode) {
  let rSum = 0, gSum = 0, bSum = 0, count = 0
  const colorCounts = new Map()
  let maxCount = 0
  let dominant = null

  for (let y = startY; y < startY + h; y++) {
    for (let x = startX; x < startX + w; x++) {
      const i = (y * imgWidth + x) * 4
      if (data[i + 3] < 128) continue
      const r = data[i], g = data[i + 1], b = data[i + 2]
      count++
      if (mode === 'average') {
        rSum += r; gSum += g; bSum += b
      } else {
        const key = `${r},${g},${b}`
        const entry = colorCounts.get(key)
        if (entry) {
          entry.count++
        } else {
          colorCounts.set(key, { rgb: { r, g, b }, count: 1 })
        }
        const c = colorCounts.get(key)
        if (c.count > maxCount) {
          maxCount = c.count
          dominant = c.rgb
        }
      }
    }
  }

  if (count === 0) return null
  if (mode === 'average') {
    return { r: Math.round(rSum / count), g: Math.round(gSum / count), b: Math.round(bSum / count) }
  }
  return dominant
}

// 核心像素化：将图片转为拼豆网格
export function pixelateImage(ctx, imgWidth, imgHeight, cols, rows, mode, maxColors, mergeThreshold = 0) {
  const imgData = ctx.getImageData(0, 0, imgWidth, imgHeight)
  const data = imgData.data
  const cellW = imgWidth / cols
  const cellH = imgHeight / rows

  const grid = []
  for (let j = 0; j < rows; j++) {
    const row = []
    for (let i = 0; i < cols; i++) {
      const sx = Math.floor(i * cellW)
      const sy = Math.floor(j * cellH)
      const ex = Math.min(imgWidth, Math.ceil((i + 1) * cellW))
      const ey = Math.min(imgHeight, Math.ceil((j + 1) * cellH))
      const cw = Math.max(1, ex - sx)
      const ch = Math.max(1, ey - sy)

      const rgb = getCellColor(data, imgWidth, sx, sy, cw, ch, mode)
      if (rgb) {
        row.push(findClosestColor(rgb))
      } else {
        row.push(null)
      }
    }
    grid.push(row)
  }

  return limitColors(grid, maxColors, mergeThreshold)
}

// 获取色板
export function getPalette() {
  return PALETTE
}
