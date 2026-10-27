# ADR-0001：技术栈

状态：已接受 · 2026-10-27

## 背景

macOS 桌面应用，需要 SQLite 数据库、系统托盘/全局快捷键、可深度定制的 UI、同一代码库的 Web/移动浏览器访问与 CLI/MCP。

## 决策

- Electron 45 + electron-vite 生态（本仓库使用 esbuild 打包主进程/服务） + electron-builder 26。
- React 19.3 + Vite 8.3 + Tailwind 4.3（设计 tokens 以自定义 CSS 变量为主）；TanStack Router/Query、Zustand。
- Hono 4.13 + `@hono/node-server`，运行在 Electron utilityProcess；CLI 通过 HTTP 调用同一服务。
- SQLite：Node 内置 `node:sqlite`（见 ADR-0008），WAL。
- TypeScript 5.9 strict；pnpm 10 workspace + Turborepo；Vitest 5 + Playwright 1.64。
- 图标 Lucide；拖拽 dnd-kit；文档 TipTap 3；图表与日历/时间轴自绘 SVG/CSS。

## 结果

- 全 TypeScript 单栈、离线可构建、无原生模块编译。
- Electron 体积较大（~150MB），接受。
- 如果未来需要 Windows/Linux，领域层与 UI 可迁移到 Tauri 或纯 Node 服务。
