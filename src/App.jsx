import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import FancyTextPage from './features/fancy-text/FancyTextPage'
import NotepadPage from './features/notepad/NotepadPage'
import InvoicePage from './features/invoice/InvoicePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/fancy-text" element={<FancyTextPage />} />
        <Route path="/notepad" element={<NotepadPage />} />
        <Route path="/invoice" element={<InvoicePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
