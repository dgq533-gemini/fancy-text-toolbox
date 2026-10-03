import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import HomePage from './pages/HomePage'
import PixelBeadsPage from './features/pixel-beads/PixelBeadsPage'
import FancyTextPage from './features/fancy-text/FancyTextPage'
import NotepadPage from './features/notepad/NotepadPage'
import InvoicePage from './features/invoice/InvoicePage'

// 路由与页面标题映射
const TITLE_MAP = {
  '/': '在线工具箱 - 免费纯前端工具集合',
  '/pixel-beads': '拼豆图纸生成器 - 图片转像素拼豆图纸 | 在线工具箱',
  '/fancy-text': '花体字神器 - 英文花体字与Emoji排版 | 在线工具箱',
  '/notepad': '极简记事本 - 本地自动保存的在线笔记 | 在线工具箱',
  '/invoice': '发票隐私脱敏 - 纯前端图片涂黑裁剪工具 | 在线工具箱',
}

/** 监听路由变化，更新网页标题 */
function TitleUpdater() {
  const location = useLocation()
  useEffect(() => {
    document.title = TITLE_MAP[location.pathname] || '在线工具箱'
  }, [location.pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <TitleUpdater />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/pixel-beads" element={<PixelBeadsPage />} />
        <Route path="/fancy-text" element={<FancyTextPage />} />
        <Route path="/notepad" element={<NotepadPage />} />
        <Route path="/invoice" element={<InvoicePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
