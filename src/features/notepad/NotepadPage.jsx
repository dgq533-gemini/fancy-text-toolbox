import { useState, useMemo, useCallback, useEffect } from 'react'
import BackButton from '../../components/BackButton'
import Footer from '../../components/Footer'

const STORAGE_KEY = 'minimal-notepad-content'

// 标点符号正则（中英文标点）
const PUNCTUATION_REGEX = /[.,!?;:'"()\[\]{}<>，。！？；：""''（）【】《》…—、·\-_/\\@#$%^&*+=~`|]/g

// 复制到剪贴板（带兜底）
const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (e) { /* 回退到 execCommand */ }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch (e) {
    return false
  }
}

/** 极简记事本页面 */
export default function NotepadPage() {
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)
  const [cleared, setCleared] = useState(false)

  // 初始化：从 localStorage 读取
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setText(saved)
    } catch (e) { /* localStorage 不可用时静默失败 */ }
  }, [])

  // 自动保存到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, text)
    } catch (e) { /* 静默失败 */ }
  }, [text])

  // 实时统计
  const stats = useMemo(() => {
    const total = text.length
    const english = (text.match(/[a-zA-Z]/g) || []).length
    const punctuation = (text.match(PUNCTUATION_REGEX) || []).length
    return { total, english, punctuation }
  }, [text])

  const handleCopy = useCallback(async () => {
    if (!text) return
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [text])

  const handleClear = useCallback(() => {
    setText('')
    setCleared(true)
    setTimeout(() => setCleared(false), 2000)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          {/* 顶部导航栏 */}
          <div className="flex items-center justify-between mb-8">
            <BackButton />
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">
              📝 极简记事本
            </h1>
            <div className="w-24" />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
            <label htmlFor="notepad-input" className="block text-sm font-medium text-gray-700 mb-2">
              开始记录...
            </label>
            <textarea
              id="notepad-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="在这里输入你的笔记，内容会自动保存到浏览器，刷新不丢失 ✨"
              rows={12}
              className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 placeholder-gray-400 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 text-base leading-relaxed"
            />

            {/* 统计信息 */}
            <div className="mt-4 flex flex-wrap gap-3">
              <StatBadge label="总字数" value={stats.total} />
              <StatBadge label="英文字数" value={stats.english} />
              <StatBadge label="标点符号" value={stats.punctuation} />
            </div>

            {/* 操作按钮 */}
            <div className="mt-5 flex gap-3">
              <button
                onClick={handleClear}
                disabled={!text}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition-all ${
                  !text ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : cleared ? 'bg-red-50 text-red-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-[0.98]'
                }`}
              >
                {cleared ? '已清空' : '🗑️ 一键清空'}
              </button>
              <button
                onClick={handleCopy}
                disabled={!text}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition-all ${
                  !text ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : copied ? 'bg-green-50 text-green-600'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100 active:scale-[0.98]'
                }`}
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    已复制
                  </>
                ) : '📋 一键复制全部文本'}
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function StatBadge({ label, value }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-gray-50 border border-gray-100 px-3 py-1.5">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-700">{value}</span>
    </div>
  )
}
