# 时序 · Dailywork

> 时间有序，专注有度。

时序是一款个人任务与知识工作台：任务、项目、看板、日历、时间轴、专注计时、flomo 式速记、块级文档与数据仪表盘。

它采用**一个服务端 + 多客户端**的结构：服务端运行在 Docker 中，持有唯一的 SQLite 数据库；桌面安装版、浏览器以及后续 Android 客户端都连接同一个服务端，因此账户与数据天然互通。

![时序 · 今日](design/qa/final-020-today.png)

## 是什么

- **一个闭环**：捕获 → 规划 → 执行（专注）→ 复盘 → 洞察。
- **不是又一个待办清单**：任务与时间、容量、专注、文档互相咬合；今天页回答「现在做什么」，仪表盘回答「最近怎么样」。
- **多端同一份数据**：服务端是唯一权威数据源；桌面端、浏览器、Android 客户端只做展示与操作，不再各自保存一套业务库。
- **账户**：注册需用户名、邮箱和至少 8 位含字母与数字的密码；注册需要验证码，登录连续失败后也会要求验证码；支持修改密码与头像（默认使用用户名首字母）。
- **版本记录**：设置 → 关于可查看每个版本的更新内容；每次发布同步更新应用内记录与 CHANGELOG。
- **数据自有**：服务端 SQLite 数据库；图片以 BLOB 存库并按 sha256 去重；支持 `.dailywork` 导出/导入，随时带走全部数据。
- **为 AI 而设计**：所有界面操作都收敛为一套 ops 契约，同时暴露 HTTP、CLI 与 MCP，AI 与人类走同一套规则。
- **克制的设计**：冷白画布、经典蓝强调色、单一字体家族、极浅阴影；支持强调色 / 语义色 / 中性色温自定义与深浅主题。

## 快速开始

### 1. 启动服务端

要求：Docker（Docker Desktop 或 Colima 均可）。

```bash
cp .env.example .env
docker compose up -d
```

服务端默认监听 `47821`，数据持久化在 `dailywork_dailywork-data` volume 的 `/data`。首次访问注册第一个账户；默认之后关闭公开注册。详见 [Docker 部署](docs/04-process/docker-deployment.md)。

### 2. 打开客户端

- **浏览器**：打开 http://127.0.0.1:47821
- **桌面版**：安装 `apps/desktop/release/Dailywork-0.2.0-arm64.dmg`，启动后默认连接 `http://127.0.0.1:47821`；通过菜单「服务器 → 服务器连接…」可改为远程服务端地址
- **Android**：后续客户端复用同一服务端 API；当前可先用手机浏览器访问同一个地址

只有服务端持有数据库；桌面端不再内置服务，也不会生成第二份数据。

### 3. 开发

要求：macOS、Node.js ≥ 22.5、pnpm 10。

```bash
pnpm install
pnpm dev
```

`pnpm dev` 会启动开发用 Hono 服务（47821）、Vite（5173）与 Electron 窗口，只用于界面与接口开发。生产运行以 Docker 服务端为准。

### 常用命令

| 命令 | 说明 |
|---|---|
| `docker compose up -d` | 启动唯一服务端（服务 + Web + SQLite） |
| `pnpm dev` | 开发用服务 + Web + Electron |
| `pnpm build` | 构建 Web / 服务 / CLI |
| `pnpm build:desktop` | 构建并打包 macOS 客户端 dmg（ad-hoc 签名，不内置服务端） |
| `pnpm test` | Vitest 单元与集成测试 |
| `pnpm test:e2e` | Playwright 核心旅程（自动启动开发服务与 Web） |
| `pnpm typecheck` | TypeScript 全量类型检查 |
| `pnpm lint` | ESLint |
| `pnpm daily -- task list` | 通过 CLI 操作服务端 |

## 数据在哪

生产数据只在服务端：

```text
/data/
  accounts.sqlite
  users/<id>/data.sqlite
  backups/
  logs/
  secrets.key
```

Docker 部署时由 `dailywork_dailywork-data` volume 挂载。桌面客户端只在 `~/Library/Application Support/Dailywork/` 保存窗口状态与 `connection.json`（服务端地址），不再保存业务数据库。

备份可以：

- 在应用「设置 → 数据与备份」导出 `.dailywork`（远程模式下文件生成在服务端，可用 `docker cp` 取出）
- 直接备份 Docker volume
- 迁移时把备份放入服务端 `/data/backups/`，填写服务端路径导入，然后重启容器

## 技术架构

Electron 45 + React 19 + TypeScript；服务端为 Hono + `node:sqlite`（WAL）；DDD 纵向切片；统一 ops 目录生成 HTTP / CLI / MCP / AI 工具四个表面。

```text
apps/
  desktop/   Electron 客户端（窗口、快捷键、连接服务端）
  server/    Hono 服务端（领域唯一写入口）
  web/       React SPA（浏览器 / 桌面共用）
  cli/       daily 命令行（HTTP 客户端 + MCP Server）
packages/
  contracts/ 共享 zod schema 与 DTO
  platform/  SQLite、迁移、路径、时间、密钥、日志
  contexts/  workspace / tasking / projects / capture / planning / focus / documents / assistant
  ops/       操作目录与执行器
  analytics/ 只读投影：仪表盘、搜索
docs/        PRD、架构、设计系统、ADR、流程文档
design/      品牌标识、架构图、设计稿与参考图
```

详细设计见 [docs/01-architecture/overview.md](docs/01-architecture/overview.md)，部署说明见 [Docker 部署](docs/04-process/docker-deployment.md)，决策记录见 [docs/03-adr](docs/03-adr)。飞书归档：[时序 · Dailywork 文档库](https://my.feishu.cn/wiki/HjuOwAe34iZPbmkzOJhcMYK1nb4)。

## 分支与协作

- `main` 只保留已发布基线，已开启分支保护；不直接开发，只通过 GitHub Pull Request 合入。
- `dev` 是日常集成分支；功能从 `dev` 切出 `feat/<scope>`，完成后先合入 `dev`。
- 发布时从 `dev` 向 `main` 提 PR，合并后在 `main` 打 `vX.Y.Z` tag。
- 远程仓库：`origin https://github.com/inezhi/dailywork.git`。

## 项目状态

**v0.2.0 · 可验收**。核心闭环已经打通：任务 / 项目 / 看板 / 四象限 / 日历 / 时间轴 / 专注 / 速记 / 文档 / 仪表盘 / AI 助理 / CLI / MCP / 备份导出导入。服务端镜像 `dailywork:0.2.0`，桌面客户端 `apps/desktop/release/Dailywork-0.2.0-arm64.dmg`。进度与已知限制见 [CHANGELOG](docs/04-process/CHANGELOG.md)。

### 验收路径（5 分钟）

1. `docker compose up -d`，浏览器打开 http://127.0.0.1:47821，注册第一个账户。
2. 安装桌面 dmg，启动后连接同一个地址；浏览器里创建的任务会出现在桌面端。
3. 在桌面端点开任务，设置预估 / 计划时间，点「开始专注」；浏览器刷新后看到同一任务与专注记录。
4. 打开「文档」，阅读《欢迎使用时序》；打开「仪表盘」查看趋势；按 `⌘K` 搜索任务。
5. 设置 → 数据与备份导出备份；手机浏览器访问同一个服务端地址即可作为移动客户端。

设计证据：`design/qa/auth-register.png`、`design/qa/account-settings.png`、`design/qa/remote-client-today.png`、`design/qa/remote-client-settings.png`、`design/qa/remote-client-connect.png`、`design/qa/final-020-releases.png`。

### 质量

- Vitest：61/61（纯单元 + 集成/路由），覆盖日期、参数解析、Ops 不变量、流式解析、备份、撤销、账户/会话/头像、邮箱、验证码、登录失败限流、服务器部署模式与 AI 护栏。
- Playwright：11/11（setup 账户 + 桌面 Chrome + WebKit iPhone 13 + 账户 UI），含注册/默认头像/上传/登录、创建、编辑、完成、速记转任务、文档重载、搜索、主题与移动布局。
- 远程客户端验收：Docker 服务端 + 打包桌面客户端，验证注册、创建任务、服务端读回、重启桌面端后会话与任务保留、连接页恢复。

## 许可

个人项目，未公开授权。
