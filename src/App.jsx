import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import PixelBeadsPage from './features/pixel-beads/PixelBeadsPage'
import FancyTextPage from './features/fancy-text/FancyTextPage'
import NotepadPage from './features/notepad/NotepadPage'
import InvoicePage from './features/invoice/InvoicePage'

export default function App() {
  return (
    <BrowserRouter>
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
