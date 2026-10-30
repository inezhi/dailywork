# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 当前状态

**v2 文档阶段，业务代码尚未开始。** 在飞书 14 篇文档定稿前，不写服务、数据库、前端或部署代码。当前仓库可见内容：

```text
old/          # v1 完整归档，只读参考
CLAUDE.md     # 本文件
README.md     # 项目说明与文档入口
```

## 项目定位

时序 / Dailywork v2：个人任务 × 时间 × 知识工作台，同时是 **Go 微服务学习项目**。产品只服务一个用户，但架构按可独立部署的服务设计，目的是练习服务边界、数据所有权、事件驱动、文档型持久化、Agent 编排、可观测性与容器化。

两个目标冲突时，产品可用性优先；不为演示技术而制造不必要的服务，也不为了用 MongoDB/Eino 而硬塞场景。

## 最重要的规则

1. **`old/` 是冻结参考。** 禁止修改、构建、import，或把旧 TypeScript 实现直接复制进新代码。可以阅读其 PRD、设计系统、数据模型、ops 契约与测试断言，作为新规格参考。
2. **文档先行。** 产品范围、服务边界、API 契约、数据模型未在飞书文档中写清楚之前，不开始实现。实现与文档冲突时，先改文档再改代码。
3. **`main` 只收 PR。** 新工作从 `v2` 切 `feat/<scope>`；完成后合回 `v2`；发布时 `v2` → `main` 提 PR。不要直接提交 `main`。
4. **一个服务一个数据库。** `identity`/`task` 用 MySQL 8，`docs`/`assistant` 用 MongoDB；禁止跨服务读表/集合；跨服务只走 API 或事件。
5. **不要造分布式单体。** 强耦合的聚合放在同一个服务；只有确实需要独立生命周期、独立扩容或独立数据所有权时才拆服务。
6. **有场景才用技术。** MongoDB 只用于文档型数据，Eino 只用于多步 Agent；简单 CRUD、单轮问答不要套框架。

## DDD 分层与依赖规则

- `domain`：实体、值对象、聚合、领域服务、领域事件、repository 接口；不 import GORM、Hertz、Kitex、MongoDB、Kafka。
- `application`：用例编排、事务边界、端口接口、DTO 转换；只依赖 domain。
- `adapters`：Hertz/Kitex handler、GORM/MongoDB repository、Kafka producer/consumer；依赖 application/domain。
- `infrastructure`：配置、日志、OpenTelemetry、连接池、迁移。
- 依赖方向是 `adapters → application → domain`；领域层不出现 SQL、GORM tag、BSON tag、HTTP/Kitex 类型。
- 聚合是事务边界；一个事务只改一个聚合；跨聚合/上下文用 ID 与事件，不做跨聚合强一致。
- repository 接口放在 domain/application，实现在 adapters；不要从 handler 直接调 GORM/MongoDB。
- 简单 CRUD 用 application + repository 即可；只有状态机、多个不变量、复杂规则才建聚合/领域服务，避免过度设计。

## 技术基线

| 层 | 选型 |
|---|---|
| 语言 | Go 1.27 |
| HTTP 网关 | Hertz（兼 BFF） |
| 平台网关 | APISIX（M6 可选：TLS、限流、灰度、API Key） |
| 内部 RPC | Kitex + Thrift |
| IDL / 代码生成 | Thrift + `kitex` / `thriftgo` |
| 关系数据库 | MySQL 8 + GORM + `golang-migrate` |
| 文档数据库 | MongoDB + `mongo-go-driver`（docs / assistant） |
| 缓存 / 会话 | Redis + `go-redis` |
| 事件 | Kafka（KRaft；本地单节点，生产多 broker） |
| 服务发现 | etcd（M1 直连，M3 接入） |
| Agent 编排 | Eino（assistant 的多步 Agent） |
| 对象存储 | MinIO（docs 附件，后续） |
| 外部契约 | REST + OpenAPI 3.1 |
| 可观测性 | `slog` + OpenTelemetry + Prometheus + Grafana + Jaeger |
| 本地编排 | 本地开发 Docker Compose；服务器部署单节点 k3s（M6） |
| 访问入口 | Tailscale（tailnet 内 HTTPS，不开公网端口） |
| 前端 | React + Vite + TanStack Router/Query（后续接入） |
| 桌面端 | Tauri 2 外壳，加载同一份 React 构建产物（仅 macOS；Windows/移动端后续） |

## 服务与数据所有权

| 服务 | 职责 | 数据 |
|---|---|---|
| `gateway` | Hertz HTTP 入口、鉴权、限流、按需 BFF 聚合、SSE | 无业务数据库 |
| `identity` | 账户、密码、会话、验证码、内部 JWT | MySQL `identity` + Redis |
| `task` | 空间、项目、任务、标签、今天查询、outbox | MySQL `task` + Kafka |
| `docs`（M7） | 文档树、块正文、反向链接 | MongoDB `docs` + MinIO |
| `assistant`（M8） | AI 对话、工具调用、流式输出 | MongoDB `assistant` |
| `planning`（后续） | 日历、容量、专注 | MySQL `planning` |
| `search` / `notification` / `calendar`（后续） | 按需拆 | 各自服务 |

MVP 只实现 `gateway + identity + task`；`docs`/`assistant` 是后续学习服务，不提前建空目录或空服务。

## 规划目录

```text
services/
  gateway/      # Hertz：路由、鉴权、SSE、按需 BFF
  identity/     # Kitex：账户、会话、验证码
  task/         # Kitex：空间、项目、任务、标签、outbox
  planning/     # Kitex：日历、容量、专注（后续）
  docs/         # Kitex + MongoDB + MinIO（M7）
  assistant/    # Kitex + Eino + MongoDB（M8）
api/
  openapi/      # 对外 REST 契约
  thrift/       # 内部 Thrift IDL
  events/       # 事件 JSON Schema
  gen/          # 生成代码（提交，CI 检查漂移）
deploy/         # docker-compose, apisix, kafka, k8s, grafana, prometheus
web/            # React SPA；桌面端外壳放 web/src-tauri
docs/           # 本地只放索引；正式文档在飞书
```

## Go 约定

- 每个入口在 `services/<name>/cmd/<name>/main.go`，业务在 `internal/`，不导出不必要的类型。
- `context.Context` 作为第一个参数贯穿调用链；所有阻塞操作必须可取消。
- 错误用 `fmt.Errorf("...: %w", err)` 包装；HTTP 层统一映射为错误信封，不把内部错误直接返回给客户端。
- 依赖通过构造函数注入；不要用全局数据库句柄或 init 里连库。
- 优雅退出：监听 SIGINT/SIGTERM，先停止接收请求，再关闭连接池、消费者与订阅。
- 配置从环境变量读取，启动时校验；密钥不写进仓库、不写日志。
- 时间戳统一 UTC ISO-8601；业务日期用客户端传入的 `YYYY-MM-DD`，不要用服务端时区推导“今天”。

## Hertz / gateway

- gateway 只做协议转换、鉴权、限流、按需 BFF 聚合和 SSE；不写任务状态机、权限或数据校验。
- 请求 ID、访问日志、trace、panic recovery 统一在中间件处理。
- 对外 REST 前缀 `/api/v1`；错误信封与 OpenAPI 保持一致。
- BFF 聚合按需使用：今天页值得聚合；如果前端并行调 2–3 个接口更简单，就让前端拼。
- APISIX（M6）只做平台职责；上 APISIX 后，TLS/IP 限流/API Key 前移，Hertz 保留用户会话与 BFF，避免重复。

## Kitex + Thrift

- Thrift IDL 放 `api/thrift/<service>/v1/*.thrift`；用 `kitex` / `thriftgo` 生成 `kitex_gen`。
- 生成代码提交到仓库；CI 检查生成漂移；不要手改 `kitex_gen`。
- gateway 用生成的 Kitex Client 调用业务服务；不要在 handler 里手写 RPC 编解码。
- Kitex 客户端统一配置超时、重试和连接池；重试只用于幂等请求。
- Kitex 业务错误用 `kerrors.NewBizStatusError` 表达，gateway 映射为统一 HTTP 错误信封。
- M1 用 `client.WithHostPorts` 直连；M3 接 etcd：服务端 `server.WithRegistry`，客户端 `client.WithResolver`。

## MySQL + GORM

- MySQL 8 + InnoDB；每个服务独立 database 与账号；迁移放 `services/<name>/migrations/`，用 `golang-migrate`。
- GORM 只负责 repository；领域模型与 GORM model 分开，不要把 GORM model 直接传到 handler。
- **不用 AutoMigrate 管生产 schema。** 表结构由迁移 SQL 创建；GORM model 只做字段映射。
- DSN：`parseTime=true&loc=UTC&charset=utf8mb4&collation=utf8mb4_0900_ai_ci`；时间戳统一 UTC。
- 事务：`db.WithContext(ctx).Transaction(func(tx *gorm.DB) error { ... })`；业务表与 outbox 必须同一事务。
- 乐观锁：`Where("id = ? AND version = ?", id, expected).Updates(...)`，检查 `RowsAffected` 是否为 0。
- 复杂查询、批量 upsert、部分索引替代用 `Raw`/显式 SQL；不要为了纯 GORM 把查询拧成难读的链式调用。
- MySQL 无部分索引：用生成列 `active_name` + 唯一索引；无 `RETURNING`：应用生成 UUID；无 `NULLS LAST`：`ORDER BY (col IS NULL), col`。
- GORM 日志接 `slog`，慢查询阈值 200ms；连接池通过底层 `sql.DB` 设置；链路用 GORM 的 OpenTelemetry 插件/回调。
- 业务表与 outbox 的写入必须在同一事务。
- 附件与大对象不进 MySQL；docs 附件进 MinIO。

## 工程规范

- **开源**：依赖许可证可审查；不复制来源不明代码；仓库不放密钥/用户数据；新增依赖说明用途、维护状态、许可证。
- **日志**：统一 `slog` JSON；字段含 `request_id`/`trace_id`；不记录密码、Token、完整 prompt、任务正文。
- **目录**：服务在 `services/<name>/cmd/<name>`，业务在 `internal/{domain,application,adapters,infrastructure}`；契约在 `api/`；部署在 `deploy/`。
- **错误**：领域/应用/适配器错误分层；对外稳定错误码；不返回堆栈、SQL、内部地址；可重试错误显式标记。
- **代码**：`gofmt`/`golangci-lint`；`context.Context` 首参；错误包装；小接口；依赖注入；禁止全局 DB 句柄。
- **接口**：对外 REST + OpenAPI 3.1；内部 Kitex + Thrift；统一错误信封；分页、幂等、版本、向后兼容；生成代码提交并检查漂移。
- **版本**：SemVer；annotated tag；CHANGELOG 只追加；迁移向前兼容；废弃字段至少保留一个版本。
- **文档**：文档先行；14 篇飞书文档为准；架构决策写 ADR；行为变化同步文档与契约。
- **Commit**：Conventional Commits；一个提交只做一件事；主题行祈使句、≤72 字符；正文写“为什么”；不提交密钥/调试代码。

规范通过 PR 模板、CI、里程碑验收和发布检查单执行，不靠口头约定。

## MongoDB

- 只用于 `docs` 与 `assistant`；`identity`/`task` 继续用 MySQL。
- `docs` 集合：`documents`、`document_bodies`、`document_links`；`assistant` 集合：`conversations`、`messages`、`tool_calls`、`ai_providers`。
- 常用索引：`documents(user_id, parent_id, sort_order)`、`document_links(target_type, target_id)`、`conversations(user_id, updated_at desc)`、`messages(conversation_id, created_at)`、`tool_calls(conversation_id, created_at)`。
- 文档正文存 JSON，带 `schema_version`；标题/图标/树位置与正文不做双写。
- 不把任务、项目、标签复制到 MongoDB；需要任务数据时通过 task 的 Kitex 只读接口获取。
- 集合变更写版本化脚本，不用“读的时候顺便补字段”。

## Kafka

- Topic：`task.events.v1`、`identity.events.v1`、`task.events.dlq.v1`；消息 key 用聚合 ID，保证同一任务进入同一分区。
- 本地 KRaft 单节点；生产 3 broker、副本 3、`min.insync.replicas=2`。
- Producer：`acks=all`、`enable.idempotence=true`；业务事务只写 outbox，由 relay 异步发布。
- Consumer：每个消费者独立 group（`gateway-sse`、`analytics`、`notification`）；处理成功后手动 commit；失败重试，超过上限进 DLQ。
- 事件 ID 放 header 和 payload；消费者用 `processed_events` 表按事件 ID 幂等。
- Kafka 只承载异步事实；同步查询/写入继续走 Kitex。

## Eino / assistant

- 只用于多步 Agent：今天做什么、任务拆解、周复盘。简单单轮问答/润色直接调模型 SDK，不套 Eino。
- 工具通过 Kitex Client 调 task/identity；只读工具自动执行，写工具必须用户确认；Agent 不允许直写数据库。
- 每次 Agent 运行设置超时、最大步数、token 预算；工具调用与结果写 `tool_calls`。
- 日志不记录 API Key、完整 prompt 或完整消息；只记录 conversation_id、tool、状态、耗时、token 用量。
- AI 供应商 Key 加密存储；提示词与工具描述变更要进 PR 审查。

## API 与契约

- 对外 API 前缀 `/api/v1`；成功与错误都使用统一信封（`data` / `error`）。
- 外部契约以 OpenAPI 3.1 为准，生成 TS 客户端与 Go 类型；内部契约以 Thrift IDL 为准。
- 变更类请求带 `Idempotency-Key`；服务端按 key 去重并返回首次结果。
- 任务等聚合带 `version`；更新可带 `expectedVersion`，冲突返回 `409 VERSION_CONFLICT`。
- 跨服务事件使用 outbox：业务写入与 outbox 记录同一事务；由后台投递到 Kafka，消费者按事件 ID 幂等。
- SSE 事件类型：`task.created|updated|completed|deleted|reopened`；AI 流式输出单独走 `/api/v1/ai/chat/stream`。

## 测试

- 单元：领域规则、状态机、校验、纯函数；表驱动，关键路径用 `go test -race`。
- 集成：testcontainers 启动 MySQL、Redis、Kafka、etcd、MongoDB；迁移与索引脚本在测试启动时执行。
- 契约：OpenAPI lint/生成漂移；Thrift/kitex 生成漂移；事件 JSON Schema。
- 端到端：Playwright 覆盖注册 → 创建任务 → 今天 → 完成 → 第二标签页 SSE 更新。
- Agent：用假模型/固定工具结果测试工具选择、确认、超时、最大步数；不依赖真实模型做 CI。
- 压测：k6 覆盖今天查询、创建任务、SSE；阈值写入测试报告。

## 可观测性

- 日志：`slog` JSON，字段含 `service`、`request_id`、`trace_id`、`user_id`、`route`、`status`、`latency_ms`；不记录正文/密钥。
- 指标：HTTP RED、数据库连接池、Kafka consumer lag、outbox 积压、SSE 连接数、MongoDB 慢查询、Agent token/工具耗时。
- 链路：OpenTelemetry 贯穿 Hertz → Kitex → MySQL/Redis/Kafka/MongoDB；Kafka 消息头带 `traceparent`。
- 健康：`/healthz` 存活、`/readyz` 检查 DB/Redis/Kafka/etcd/Mongo；失败返回 503。
- 告警：5xx、p95、outbox 积压、consumer lag、DLQ、健康检查失败。

## 文档工作流

正式文档在飞书知识库（根节点：[开发](https://my.feishu.cn/wiki/HjuOwAe34iZPbmkzOJhcMYK1nb4)），共 14 篇：

1. 项目总览
2. 产品需求文档（PRD）
3. 产品路线图与迭代计划
4. 微服务架构总览
5. 服务边界与数据归属
6. 数据模型与一致性
7. API 契约与网关
8. 事件驱动与消息
9. 安全与账户体系
10. 可观测性与运维
11. 测试策略
12. 设计系统与页面规格
13. ADR 决策记录
14. 研发流程与发布

修改文档使用 `lark-cli docs +update`，保留原文档 URL；架构图优先用飞书画板。README 中的文档链接必须与飞书节点保持一致。

## Git 与发布

- 提交遵循 Conventional Commits：`feat(scope):`、`fix(scope):`、`docs:`、`refactor:`、`test:`、`chore:`。
- 一个 PR 只做一件事；行为变化先改文档/契约，再改代码。
- 发布前跑 lint、unit、integration、contract、e2e；生成代码无漂移；迁移在空库和旧库都能执行。
- v2 从 `2.0.0` 开始；MVP 完成后打第一个 tag。版本记录在飞书 14 文档的 CHANGELOG 小节维护。

## 开发节奏

- **每天**：小步提交；先改文档/契约再改代码；当天跑 lint 和单元测试。
- **每周**：完成一个垂直切片；演示并复盘；同步飞书文档；依赖/安全检查。
- **每个里程碑**：按 03 路线图验收；更新文档与 ADR；打 tag；不满足验收不进入下一阶段。
- **发布**：迁移演练 → 备份 → 发布 → 观察 10 分钟 → 记录镜像 digest；失败按回滚清单处理。
- **复盘**：记录发生了什么、根因、下一步、谁负责、如何验证；至少一个防复发测试或监控。

## 常用命令

代码阶段尚未开始，以下命令是规划占位，暂不可用：

```bash
make up           # docker compose up -d
make down         # docker compose down
make test         # go test ./... + 集成测试
make lint         # go vet + golangci-lint
make migrate      # 各服务迁移
make codegen      # thrift/kitex 与 OpenAPI 生成
```

当前可用的只有 Git 与文档命令。`old/` 下的 pnpm/Node 命令已失效，不要执行。

## 不要做

- 不要修改 `old/`，不要从中 import 或复制实现。
- 不要跨服务读表/集合；不要共享数据库；不要跨库 JOIN。
- 不要用 AutoMigrate 管生产 schema；不要在 GORM 关联里隐藏 N+1；不要把 GORM model 直接当领域模型。
- 不要把 MongoDB 当万能库；任务、账户仍用 MySQL。
- 不要把所有 AI 调用都套 Eino；单轮问答直接调模型 SDK。
- 不要在文档、代码、注释中出现公司名、内部项目名或个人信息。
- 不要把密钥、Token、完整 prompt、用户正文写进日志。
- 不要直接把 `main` 当开发分支。
