# 项目永久记忆

启动日期：2026-10-03
核心定位：AI 工具与工作流工具箱（微 SaaS 方向），提供花体字排版、拼豆图纸生成、发票生成、记事本等在线工具
目标用户：内容创作者、手工爱好者、中小企业主、开发者
主域名：https://openaigen.vercel.app（Vercel 生产环境，别名 https://fancy-text-toolbox.vercel.app）
技术栈：Vite 6 + React 18 + React Router 7 + Tailwind CSS 3
当前阶段：功能迭代中（已上线 4 个工具模块）

## 已完成模块

| 模块 | 路径 | 说明 |
|------|------|------|
| 花体字排版器 | `src/features/fancy-text/` | 花体字 & Emoji 排版，支持实时预览 |
| 拼豆图纸生成器 | `src/features/pixel-beads/` | 图片转拼豆图纸，OKLab 色彩匹配，291 色 MARD 色板，难度/颜色数/合并阈值可调 |
| 发票生成器 | `src/features/invoice/` | 在线发票生成 |
| 记事本 | `src/features/notepad/` | 在线记事本 |
| 首页 | `src/pages/HomePage.jsx` | 工具箱导航页 |

## 关键决策记录

1. **色彩匹配算法**：采用 OKLab 色彩空间做最近邻匹配，比 RGB/HSV 更符合人眼感知。色板为 291 色 MARD 拼豆色板。
2. **颜色合并**：`mergeByThreshold(grid, threshold)` 按 OKLab 距离合并相似颜色（不常用色合并到常用色），阈值滑块 0~100 映射到距离 0~0.5。
3. **颜色数量联动**：`beadCounts` 更新后自动同步 `colorCount`，保持颜色精简度与原材料清单一致；有合并阈值时不限制颜色数量（阈值主导），阈值归零时临时解除限制让颜色恢复。
4. **缩放性能优化**：渲染与缩放分离。canvas 固定 2x 分辨率渲染（`BASE_SCALE=2`），zoom 变化只改 `canvas.style.width/height`，由浏览器硬件加速缩放，**缩放零重绘**。
5. **默认参数**：颜色合并阈值默认 10，长边默认 100。

## 工具数据库版本

- MARD 拼豆色板：291 色（`src/features/pixel-beads/beadPalette.js`）
- 依赖版本：React 18.3.1 / React Router 7.18.4 / Vite 6.0.5 / Tailwind 3.4.17

## 常用操作（防止失忆）

### 本地开发
```powershell
$env:Path = "d:\桌面备份\20260603\U-Hermes\HermesUSBMaker\cache\node-portable;" + $env:Path
npm run dev
```
- Node 便携版路径：`d:\桌面备份\20260603\U-Hermes\HermesUSBMaker\cache\node-portable`
- 所有 shell 命令需 `dangerouslyDisableSandbox: true`

### 构建验证
```powershell
npm run build
```

### 推送到 GitHub（版本管理）
```powershell
git add .
git commit -m "提交说明"
git push origin main
```
- 远程仓库：https://github.com/dgq533-gemini/fancy-text-toolbox
- GitHub 认证：gh CLI 已登录（token 存储于系统目录，勿写入本文件）
- 分支：main

### 发布到 Vercel（自动）
- **无需手动操作**：Vercel 项目已连接 GitHub 仓库，`git push` 后自动构建部署
- 生产 URL：https://openaigen.vercel.app
- Vercel 认证：`vercel login` 已登录（token 存储于系统目录，勿写入本文件）

### 发布到 Vercel（手动，如需）
```powershell
$env:Path = "d:\桌面备份\20260603\U-Hermes\HermesUSBMaker\cache\node-portable;" + $env:Path
npx vercel --prod --yes --name fancy-text-toolbox
```

### Git 权限问题
- Windows 环境 git 写对象文件可能被 Defender 拦截，需 `dangerouslyDisableSandbox: true`

## 已知问题与解决方案

| 问题 | 解决方案 |
|------|---------|
| 缩放时卡顿 | 渲染与缩放分离，canvas 固定分辨率，zoom 只改 CSS 尺寸 |
| 阈值归零后颜色数不恢复 | 归零时 `setColorCount(291)` 临时解除限制，再由 effect 同步实际值 |
| colorCount 联动导致循环 | effect 只依赖 `beadCounts`，用函数式 `setColorCount((cc) => ...)` 读取最新值 |
| PowerShell 不支持 `&&` | 用 `;` 分隔命令 |

## 安全说明

- 本文件不存储任何明文 token、密码、密钥
- GitHub / Vercel 凭证均存储于系统认证目录（`%APPDATA%`），由 CLI 自动读取
- 如需重新认证：`gh auth login` / `npx vercel login`

- 已确认人工信息增益签名：dgq533
