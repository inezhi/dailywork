# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概况

时序 / Dailywork 是一款本地优先的 macOS 个人任务与知识工作台。Electron 45 + React 19 + TypeScript 单栈，Hono 本地服务运行在 Electron utilityProcess，SQLite（`node:sqlite`，WAL）是唯一权威数据源，**不使用 iCloud 或任何云同步**。全部界面操作收敛到 `packages/ops` 的操作目录，同时生成 HTTP、CLI、MCP、AI 工具四个表面。

## 常用命令

- `pnpm dev`：并行启动服务（47821）、Vite（5173）与 Electron（dev 模式 Electron 加载 Vite）。
- `pnpm dev:server` / `pnpm dev:web` / `pnpm dev:desktop`：单独启动。
- `pnpm test`：Vitest（`packages/**/*.test.ts`、`apps/server/src/**/*.test.ts`）。
- 单个测试：`pnpm vitest run apps/server/src/app.test.ts -t "creates and lists tasks"`。
- `pnpm typecheck`：`tsconfig.node.json`（Node 侧）+ `tsconfig.web.json`（Web 侧），路径别名指向 TS 源码，无需先构建。
- `pnpm lint` / `pnpm format`：ESLint 9 flat config / Prettier。
- `pnpm build:desktop`：构建 Web + 服务，然后 electron-builder 打 dmg（ad-hoc 签名）。
- `pnpm daily -- task list --json`：CLI 通过 `runtime.json` 发现本地服务；服务未运行时自动以 headless 方式拉起。

## 架构要点

- **单一写入口**：只有 `apps/server` 内的 ops 执行器写数据库。Web、CLI、MCP、AI 都通过 `POST /api/ops/<name>` 调用；不要为某个界面另开直写 SQL 的后门。
- **ops 契约**：`packages/ops/src/*-ops.ts` 用 `defineOp` 声明 name / zod input / exposure / annotations / handler。新增能力先加 op，再在 Web 或 CLI 消费；CLI 命令树由 `exposure.cli` 自动生成。
- **DDD 上下文**：`packages/contexts/<context>/src/index.ts` 是每个上下文的公开应用接口；跨上下文只调用对方的导出函数，不跨包读表。`packages/analytics` 是允许跨表只读的投影层。
- **数据库**：schema 在 `packages/platform/src/migrations/v1.ts`，启动时自动迁移 + 种子（默认空间、设置）。`packages/platform/src/db.ts` 暴露 `openDatabase`、`transaction`、`recordOp`。所有变更必须在事务内同时写业务表与 `op_log`。
- **审计与幂等**：每个 command op 带 `opId`；`op_log.op_id` 唯一，重复请求返回已存结果。破坏性 op 在 HTTP 层要求 `confirm: true`。
- **日期**：业务日期一律是本地时区的 `YYYY-MM-DD` 字符串（`packages/platform/src/time.ts`），时间戳是 UTC ISO；不要用 UTC 日期推导「今天」。
- **图片**：blobs 表按 sha256 去重存 BLOB，attachments 多态关联 task/document/memo；文档正文通过 `attachment://<id>` 引用。
- **Web**：TanStack Router（代码式路由）+ TanStack Query + Zustand；设计 tokens 在 `apps/web/src/styles.css`，主题由设置里的 accent/semantic/neutral 在运行时写入 CSS 变量。服务通过 SSE `/api/events` 广播 command 完成事件，Web 收到后统一失效查询。
- **桌面**：`apps/desktop/src/main.ts` 在打包模式下用 utilityProcess 启动 `resources/server/server.mjs`，随机端口，等待 `/api/health` 就绪后加载；生产环境由 Hono 同源托管 `resources/web` 静态文件。
- **CLI 发现**：服务把 `{url, port, token, pid}` 写入 `<dataDir>/runtime.json`（0600）；CLI 先探测健康，失败则 spawn headless server。
- **测试隔离**：服务测试使用临时 `DAILYWORK_DATA_DIR`；`createApp` 接受 `dataDir` 与 `webDist`，可直接用 `app.request()` 做无端口集成测试。

## 非显而易见约定

- 工作区包统一 `"exports": "./src/index.ts"`，开发与测试直接消费 TS 源码，生产由 esbuild/Vite 打包；不要给包加独立 build 步骤。
- 路径别名定义了三处并需同步：`tsconfig.base.json`、`vitest.config.ts`、`apps/web/vite.config.ts`。
- `focus_sessions` 有一个部分唯一索引保证同时只有一个 running 会话；开始新专注前先检查 `focus.active`。
- 文档正文存 TipTap JSON（`document_bodies.content_json`），标题/图标/摘要是 SQLite 元数据；`document_links` 从正文里的 `task://`、`project://`、`document://` 引用中提取，用于反向链接。
- `op_log` 同时是审计、撤销底稿与导出重放依据；删除采用硬删除但 `after_json` 保留完整快照。
- 设计资产在 `design/`（品牌、架构图、9 张参考设计稿）；`design/mockups` 是 HTML 高保真稿，实现时以其视觉为准但以设计 tokens 为准绳。
