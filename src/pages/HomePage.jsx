import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

/** 主页：展示所有工具入口 */
const tools = [
  {
    path: '/pixel-beads',
    icon: '🧩',
    title: '拼豆图纸生成器',
    desc: '上传图片自动生成拼豆图纸，支持画布大小调节、颜色精简、珠子计数与高清打印底稿导出。',
    tag: '手工创作',
  },
  {
    path: '/fancy-text',
    icon: '✨',
    title: '花体字神器',
    desc: '英文字母与数字一键转换为花体字，搭配随机 Emoji 装饰，社交媒体文案必备。',
    tag: '文字转换',
  },
  {
    path: '/notepad',
    icon: '📝',
    title: '极简记事本',
    desc: '纯前端本地记事本，内容自动保存到浏览器，刷新不丢失，实时字数统计。',
    tag: '笔记记录',
  },
  {
    path: '/invoice',
    icon: '🔒',
    title: '发票隐私脱敏',
    desc: '纯前端离线处理，拖拽图片框选敏感信息，像素级涂黑销毁，支持旋转裁剪与下载。',
    tag: '隐私保护',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col">
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-3xl">
          {/* 标题 */}
          <header className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-semibold text-gray-800 tracking-tight">
              在线工具箱
            </h1>
            <p className="mt-2 text-gray-500 text-sm sm:text-base">
              纯前端工具，无需注册，数据不上传服务器
            </p>
          </header>

          {/* 工具卡片网格 */}
          <div className="grid gap-4 sm:grid-cols-3">
            {tools.map((tool) => (
              <Link
                key={tool.path}
                to={tool.path}
                className="group bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-gray-200 transition-all duration-200 flex flex-col"
              >
                <div className="text-4xl mb-4">{tool.icon}</div>
                <h2 className="text-lg font-semibold text-gray-800 mb-1">
                  {tool.title}
                </h2>
                <span className="inline-block w-fit text-xs text-blue-500 bg-blue-50 rounded-full px-2.5 py-0.5 mb-3">
                  {tool.tag}
                </span>
                <p className="text-sm text-gray-500 leading-relaxed flex-1">
                  {tool.desc}
                </p>
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-gray-400 group-hover:text-gray-600 transition-colors">
                  开始使用
                  <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>

          {/* 安全提示 */}
          <div className="mt-8 text-center text-xs text-gray-400">
            所有工具均在浏览器本地运行，您的数据绝不会上传到任何服务器 🔒
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
