import { useNavigate } from 'react-router-dom'

/** 返回主页按钮 */
export default function BackButton() {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate('/')}
      className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 active:scale-95 transition-all shadow-sm"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      返回主页
    </button>
  )
}
