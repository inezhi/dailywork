# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 版本与更新记录（发布时必须执行）

当前版本：**0.2.0**。版本记录是产品的一部分：用户可在「设置 → 关于 → 版本记录」查看每个版本的更新内容。

每次发布按以下顺序完成，缺一不可：

1. 更新根目录与 `apps/*`、`packages/*` 的 `version`（semver），以及 `apps/server/src/app.ts`、`apps/server/src/index.ts`、`apps/cli/src/index.ts`、`packages/ops/src/system-ops.ts` 中的版本常量。
2. 在 `apps/web/src/content/releases.ts` 顶部新增一条版本记录（标题、日期、新增/改进/修复）；这是产品内展示的版本记录。
3. 在 `docs/04-process/CHANGELOG.md` 顶部写同样内容的 Markdown 版本记录。
4. 更新 README 的安装包路径与版本号；运行 `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`。
5. 用 `pnpm build:desktop` 重新打 dmg（版本号会进入文件名与安装包元数据），提交后打 `vX.Y.Z` tag。

不要删除历史版本记录；只追加新版本。

## 项目概况

时序 / Dailywork 是一款个人任务与知识工作台，采用**一个服务端 + 多客户端**结构。服务端（Hono + `node:sqlite`，WAL）运行在 Docker 中，SQLite 是唯一权威数据源；桌面 Electron、浏览器与后续 Android 客户端都连接同一服务端，不各自保存业务库。全部界面操作收敛到 `packages/ops` 的操作目录，同时生成 HTTP、CLI、MCP、AI 工具四个表面。

## 分支与协作

- `main` 只保留发布基线，不直接开发；只通过 GitHub Pull Request 合入。
- `dev` 是日常集成分支；功能从 `dev` 切出 `feat/<scope>`，完成后先合入 `dev`。
- 发布时从 `dev` 向 `main` 提 PR；合并后在 `main` 打 `vX.Y.Z` tag。
- 远程仓库：`origin https://github.com/inezhi/dailywork.git`。

## 常用命令

- `pnpm dev`：并行启动服务（47821）、Vite（5173）与 Electron（dev 模式 Electron 加载 Vite）。
- `pnpm dev:server` / `pnpm dev:web` / `pnpm dev:desktop`：单独启动。
- `pnpm test`：Vitest 单元 + 集成测试（58 个，含账户/会话/头像/服务器部署模式）（`packages/**/*.test.ts`、`apps/server/src/**/*.test.ts`、`apps/cli/src/**/*.test.ts`、`apps/web/src/lib/**/*.test.ts`）。
- `pnpm test:e2e`：Playwright（setup 创建测试账户 → 桌面 Chrome + WebKit iPhone + 账户 UI，共 11 个；webServer 自动启动 `.data-e2e` 服务与 Vite）。
- `e2e/remote-client.mjs`：打包客户端连接 Docker 服务端的验收（注册、任务、服务端读回、重启会话、连接页恢复；需设置 `APP_PATH` 与 `SERVER_URL`）。
- 视觉/交互 QA：`node e2e/qa-screenshots.mjs`、`e2e/*-qa.mjs`、`node e2e/packaged-*.mjs`（需已构建 dmg/app）。
- `pnpm lan:https`：在数据目录生成局域网 HTTPS 证书（自签名，含当前 LAN IP）；重启后 HTTPS 监听固定端口 47822。
- 单个测试：`pnpm vitest run apps/server/src/app.test.ts -t "creates and lists tasks"`。
- `pnpm typecheck`：`tsconfig.node.json`（Node 侧）+ `tsconfig.web.json`（Web 侧），路径别名指向 TS 源码，无需先构建。
- `pnpm lint` / `pnpm format`：ESLint 9 flat config / Prettier。
- `pnpm build:desktop`：只构建并打包 macOS 桌面客户端（ad-hoc 签名），不再内置 Web/服务端产物。
- `docker compose up -d --build`：构建并启动容器（服务 + Web + SQLite，数据卷 `/data`）；详见 `docs/04-process/docker-deployment.md`。
- `pnpm daily -- task list --json`：CLI 通过 `runtime.json` 发现服务；服务未运行时自动以 headless 方式拉起。

## 架构要点

- **单一写入口**：只有 `apps/server` 内的 ops 执行器写数据库。Web、CLI、MCP、AI 都通过 `POST /api/ops/<name>` 调用；不要为某个界面另开直写 SQL 的后门。
- **ops 契约**：`packages/ops/src/*-ops.ts` 用 `defineOp` 声明 name / zod input / exposure / annotations / handler。新增能力先加 op，再在 Web 或 CLI 消费；CLI 命令树由 `exposure.cli` 自动生成。
- **DDD 上下文**：`packages/contexts/<context>/src/index.ts` 是每个上下文的公开应用接口；跨上下文只调用对方的导出函数，不跨包读表。`packages/analytics` 是允许跨表只读的投影层。
- **数据库**：schema 在 `packages/platform/src/migrations/v1.ts`，启动时自动迁移 + 种子（默认空间、设置）。`packages/platform/src/db.ts` 暴露 `openDatabase`、`transaction`、`recordOp`。
- **账户**：服务端 `<dataDir>/accounts.sqlite` 存 users/sessions（scrypt）；每个账户独立 `<dataDir>/users/<id>/data.sqlite`，所有客户端共享。`/api/auth/*` 管理注册/登录/改密/头像；未登录 `/api/*` 返回 401（首账户创建前除外）。CLI/MCP 用 runtime Bearer token 映射首个账户；局域网配对建立首个账户会话。Web 入口是 `AuthGate`，默认头像取用户名首字母。所有变更必须在事务内同时写业务表与 `op_log`。**服务器部署模式**由 `DAILYWORK_SERVER_MODE=1` 开启：允许远程登录、跳过 LAN 配对开关、静态首页直接进入登录页；`DAILYWORK_OPEN_REGISTRATION=1` 才允许首个账户之后继续公开注册。`DAILYWORK_SECURE_COOKIES`/`DAILYWORK_TRUST_PROXY` 控制 TLS 代理下的 Secure cookie。
- **审计与幂等**：每个 command op 带 `opId`；`op_log.op_id` 唯一，重复请求返回已存结果。破坏性 op 在 HTTP 层要求 `confirm: true`。
- **日期**：业务日期一律是用户所在时区的 `YYYY-MM-DD` 字符串（`packages/platform/src/time.ts`），时间戳是 UTC ISO。服务端可能运行在 UTC，因此客户端必须把浏览器计算出的 `today` 传给 `today.get`（今天页与侧栏已这样做）；不要依赖服务端时区推导「今天」。
- **图片**：blobs 表按 sha256 去重存 BLOB，attachments 多态关联 task/document/memo；文档正文通过 `attachment://<id>` 引用。
- **Web**：TanStack Router（代码式路由）+ TanStack Query + Zustand；设计 tokens 在 `apps/web/src/styles.css`，主题由设置里的 accent/semantic/neutral 在运行时写入 CSS 变量。服务通过 SSE `/api/events` 广播 command 完成事件，Web 收到后统一失效查询。
- **桌面**：`apps/desktop/src/main.ts` 是远程客户端。打包版读取 `DAILYWORK_SERVER_URL` 或 `<dataDir>/connection.json` 的 `serverUrl`，等待服务端 `/api/health` 后直接加载；不启动内置服务。服务端不可达时加载 `connection.html` 配置页；菜单「服务器 → 服务器连接…」可重新配置。`window.dailywork.remote` 为 true 时，设置页隐藏桌面专属的打开目录/客户端备份选择器。
- **CLI 发现**：服务把 `{url, port, token, pairingCode, pid}` 写入 `<dataDir>/runtime.json`（0600）；`server-token` 持久化（0600），局域网配对 cookie 重启后仍有效；CLI 先探测健康，失败则 spawn headless server。
- **测试隔离**：服务测试使用临时 `DAILYWORK_DATA_DIR`；`createApp` 接受 `dataDir` 与 `webDist`，可直接用 `app.request()` 做无端口集成测试。Playwright 的 webServer 使用 `$PWD/.data-e2e`（已忽略）。
- **局域网**：打包版服务绑定 `0.0.0.0`；非 loopback 请求要求设置开启 `lanEnabled` 且携带配对 cookie/Bearer；`/pair` 与 `/api/pair` 不需要鉴权但有配对码与限流。数据目录存在 `certs/server.crt`+`server.key` 时会额外启动 HTTPS（47822），供手机 PWA 离线使用；证书由 `lan.setupHttps` 或 `pnpm lan:https` 生成。支持 WebKit 手机 e2e。
- **备份**：`.dailywork` 包含当前账户数据库 + manifest；账户级导出不含 `secrets.key`。远程客户端导出时文件生成在服务端，导入时填写服务端路径；先校验与暂存，`applyPendingImport` 在服务端重启时原子替换。每日启动自动生成快照，保留 14 份。

## 非显而易见约定

- 工作区包统一 `"exports": "./src/index.ts"`，开发与测试直接消费 TS 源码，生产由 esbuild/Vite 打包；不要给包加独立 build 步骤。
- 路径别名定义了三处并需同步：`tsconfig.base.json`、`vitest.config.ts`、`apps/web/vite.config.ts`。
- `focus_sessions` 有一个部分唯一索引保证同时只有一个 running 会话；开始新专注前先检查 `focus.active`。
- 文档正文存 TipTap JSON（`document_bodies.content_json`），标题/图标/摘要是 SQLite 元数据；`document_links` 从正文里的 `task://`、`project://`、`document://` 引用中提取，用于反向链接。
- `op_log` 同时是审计、撤销底稿与导出重放依据；`before_json`/`after_json` 保留快照，`history.undo` 仅撤销最近一次任务操作（项目/文档/对话不自动回滚）。
- 设计资产在 `design/`（品牌、架构图、9 张参考设计稿、`design/qa` 验收截图）；`design/mockups` 是 HTML 高保真稿，实现时以其视觉为准但以设计 tokens 为准绳。
- AI 上下文动作：任务抽屉 / 文档工具栏 / 周复盘通过 `useUi.openAi({context,draft})` 打开面板；`ai.chat` 的系统提示按 context 注入任务、文档或周复盘数据。Web 使用 `/api/ai/chat/stream`（SSE：start / tool_start / tool_result / delta / done），CLI/MCP 仍走非流式 `ai.chat`。
