import { useState, useMemo, useCallback, useEffect } from 'react'

// ==================== 常量与工具函数 ====================

// 可爱 Emoji 列表
const CUTE_EMOJIS = [
  '🌸', '🌺', '🌻', '🌷', '🌹', '🌼', '🍀', '🍃',
  '🌈', '✨', '⭐', '💫', '🌟', '💖', '💕', '💗',
  '🦋', '🐰', '🐱', '🐶', '🐼', '🦊', '🐻', '🐨',
  '🐯', '🦁', '🐸', '🐵', '🐧', '🦉', '🐺', '🐴',
  '🦄', '🐝', '🐞', '🐌', '🐛', '🐙', '🦑', '🦐',
  '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐢', '🦎',
  '🍓', '🍒', '🍑', '🍎', '🍊', '🍋', '🍉', '🍇',
  '🍰', '🍩', '🍪', '🎂', '🧁', '🍬', '🍭', '🍫',
  '🎀', '🎈', '🎉', '🎊', '💝', '💞', '💟', '❣️',
]

// Double-struck (花体字) 字符映射
const DOUBLE_STRUCK = {
  'A': '𝔸', 'B': '𝔹', 'C': 'ℂ', 'D': '𝔻', 'E': '𝔼', 'F': '𝔽',
  'G': '𝔾', 'H': 'ℍ', 'I': '𝕀', 'J': '𝕁', 'K': '𝕂', 'L': '𝕃',
  'M': '𝕄', 'N': 'ℕ', 'O': '𝕆', 'P': 'ℙ', 'Q': 'ℚ', 'R': 'ℝ',
  'S': '𝕊', 'T': '𝕋', 'U': '𝕌', 'V': '𝕍', 'W': '𝕎', 'X': '𝕏',
  'Y': '𝕐', 'Z': 'ℤ',
  'a': '𝕒', 'b': '𝕓', 'c': '𝕔', 'd': '𝕕', 'e': '𝕖', 'f': '𝕗',
  'g': '𝕘', 'h': '𝕙', 'i': '𝕚', 'j': '𝕛', 'k': '𝕜', 'l': '𝕝',
  'm': '𝕞', 'n': '𝕟', 'o': '𝕠', 'p': '𝕡', 'q': '𝕢', 'r': '𝕣',
  's': '𝕤', 't': '𝕥', 'u': '𝕦', 'v': '𝕧', 'w': '𝕨', 'x': '𝕩',
  'y': '𝕪', 'z': '𝕫',
  '0': '𝟘', '1': '𝟙', '2': '𝟚', '3': '𝟛', '4': '𝟜',
  '5': '𝟝', '6': '𝟞', '7': '𝟟', '8': '𝟠', '9': '𝟡',
}

const randomEmoji = () => CUTE_EMOJIS[Math.floor(Math.random() * CUTE_EMOJIS.length)]

const toFancyText = (text) => {
  let result = ''
  for (const char of text) {
    result += DOUBLE_STRUCK[char] || char
  }
  return result
}

// 复制到剪贴板（带兜底）
const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (e) {
    // 回退到 execCommand
  }
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

// 标点符号正则（中英文标点）
const PUNCTUATION_REGEX = /[.,!?;:'"()\[\]{}<>，。！？；：""''（）【】《》…—、·\-_/\\@#$%^&*+=~`|]/g

// ==================== 主组件 ====================

export default function App() {
  const [activeTab, setActiveTab] = useState('fancy')

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col">
      {/* 主体内容 */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          {/* 标题 */}
          <header className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-semibold text-gray-800 tracking-tight">
              在线工具箱
            </h1>
            <p className="mt-2 text-gray-500 text-sm sm:text-base">
              花体字生成 · 极简记事本，纯前端工具，无需注册
            </p>
          </header>

          {/* 标签页切换 */}
          <Tabs activeTab={activeTab} onChange={setActiveTab} />

          {/* 工具内容区 */}
          <div className="mt-6">
            {activeTab === 'fancy' ? <FancyTextTool /> : <NotepadTool />}
          </div>
        </div>
      </main>

      {/* 底部广告占位符 - 始终显示 */}
      <footer className="px-4 pb-6">
        <div className="mx-auto max-w-2xl">
          <div className="bg-gray-200 rounded-xl h-24 sm:h-28 flex items-center justify-center border border-dashed border-gray-300">
            <span className="text-gray-400 text-sm">
              Google AdSense 广告位
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ==================== 标签页组件 ====================

function Tabs({ activeTab, onChange }) {
  const tabs = [
    { id: 'fancy', label: '✨ 花体字神器' },
    { id: 'notepad', label: '📝 极简记事本' },
  ]

  return (
    <div className="flex p-1 bg-gray-100 rounded-2xl">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
            activeTab === tab.id
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ==================== 工具一：花体字神器 ====================

function FancyTextTool() {
  const [input, setInput] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [emojiSeed, setEmojiSeed] = useState(0)

  const emojiResult = useMemo(() => {
    if (!input.trim()) return ''
    const prefix = randomEmoji()
    const suffix = randomEmoji()
    return `${prefix} ${input.trim()} ${suffix}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, emojiSeed])

  const fancyResult = useMemo(() => {
    if (!input) return ''
    return toFancyText(input)
  }, [input])

  const handleCopy = useCallback(async (id, text) => {
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }, [])

  const handleShuffle = useCallback(() => {
    setEmojiSeed((s) => s + 1)
  }, [])

  return (
    <>
      {/* 输入卡片 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
        <label
          htmlFor="text-input"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          输入你的文字
        </label>
        <textarea
          id="text-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="在这里输入文字，例如：Hello World 123"
          rows={4}
          className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 placeholder-gray-400 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 text-base"
        />
        <div className="mt-2 flex justify-between items-center">
          <span className="text-xs text-gray-400">
            {input.length} 字符
          </span>
          {input.trim() && (
            <button
              onClick={handleShuffle}
              className="text-xs text-blue-500 hover:text-blue-600 transition-colors flex items-center gap-1"
            >
              <span>🎲</span>
              <span>重新随机 Emoji</span>
            </button>
          )}
        </div>
      </div>

      {/* 结果区 */}
      <div className="mt-6 space-y-4">
        <ResultCard
          id="emoji"
          title="结果 1 · Emoji 装饰排版"
          value={emojiResult}
          copied={copiedId === 'emoji'}
          onCopy={() => handleCopy('emoji', emojiResult)}
          empty={!input.trim()}
        />
        <ResultCard
          id="fancy"
          title="结果 2 · 花体字转换"
          value={fancyResult}
          copied={copiedId === 'fancy'}
          onCopy={() => handleCopy('fancy', fancyResult)}
          empty={!input}
        />
      </div>

      {/* 使用提示 */}
      {!input && (
        <div className="mt-6 text-center text-sm text-gray-400">
          在上方输入框中输入文字，结果会实时显示 ✨
        </div>
      )}
    </>
  )
}

// ==================== 工具二：极简记事本 ====================

const STORAGE_KEY = 'minimal-notepad-content'

function NotepadTool() {
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)
  const [cleared, setCleared] = useState(false)

  // 初始化：从 localStorage 读取
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setText(saved)
    } catch (e) {
      // localStorage 不可用时静默失败
    }
  }, [])

  // 自动保存到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, text)
    } catch (e) {
      // 静默失败
    }
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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
      <label
        htmlFor="notepad-input"
        className="block text-sm font-medium text-gray-700 mb-2"
      >
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
            !text
              ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
              : cleared
              ? 'bg-red-50 text-red-500'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-[0.98]'
          }`}
        >
          {cleared ? '已清空' : '🗑️ 一键清空'}
        </button>
        <button
          onClick={handleCopy}
          disabled={!text}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition-all ${
            !text
              ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
              : copied
              ? 'bg-green-50 text-green-600'
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
          ) : (
            '📋 一键复制全部文本'
          )}
        </button>
      </div>
    </div>
  )
}

// ==================== 子组件 ====================

function ResultCard({ title, value, copied, onCopy, empty }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        <button
          onClick={onCopy}
          disabled={empty}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
            empty
              ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
              : copied
              ? 'bg-green-50 text-green-600'
              : 'bg-blue-50 text-blue-600 hover:bg-blue-100 active:scale-95'
          }`}
        >
          {copied ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              已复制
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              一键复制
            </>
          )}
        </button>
      </div>
      <div className="min-h-[3rem] rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-gray-800 break-words text-lg leading-relaxed">
        {empty ? <span className="text-gray-300">等待输入...</span> : value}
      </div>
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
