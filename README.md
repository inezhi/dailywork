# 时序 / Dailywork v2

个人任务 × 时间 × 知识工作台。v2 同时是一个 **Go 微服务学习项目**：用一个真实可用的产品，练习服务边界、数据所有权、事件驱动、可观测性与容器化。

> 当前状态：**文档阶段**。代码尚未开始；仓库里只有 v1 归档与 v2 文档入口。

## 为什么重做

v1 是一个 TypeScript 单体（Hono + SQLite + React/Electron），功能已经完整，但架构目标已经变化：

- 产品只服务一个人，不需要背着历史实现；
- 下一阶段的目标是 Go 微服务实践，而不是继续扩展单体；
- v1 的代码、文档、设计稿已完整保存在 `main`、`v0.2.0` tag 和远端仓库中。

因此 v2 从零开始，先把产品与架构写成文档，再写代码。

## 学习目标

这个项目不是玩具 demo，而是一个能长期自用的产品。通过它练习：

- 按限界上下文拆分服务，而不是按技术层拆；
- 每个服务独立数据库，跨服务只走 API 或事件；
- 同步查询与异步事件的边界、outbox、幂等与最终一致；
- Redis 会话/缓存、NATS JetStream 事件流；
- OpenTelemetry 日志、指标、链路，以及 Docker Compose / K8s 部署；
- Go 的工程习惯：`context.Context`、显式错误、接口小、依赖注入、优雅退出、表驱动测试。

## 规划架构

```text
浏览器 / 未来移动端
        │ HTTPS
        ▼
   gateway (Go)
   ├── identity    账户、会话、验证码、头像
   ├── task        空间、项目、任务、标签、速记
   ├── planning    日历、容量、专注会话
   ├── docs        文档、正文、附件
   └── assistant   AI 供应商、对话、流式输出
        │
        ├── PostgreSQL（每个服务独立库）
        ├── Redis（会话、缓存、限流）
        ├── NATS JetStream（领域事件）
        └── MinIO（附件对象存储，后期）
```

MVP 只实现 **gateway + identity + task**，跑通注册、登录、创建任务、今天列表；其余服务按路线图逐步拆出。

## 规划技术栈

| 层 | 选型 |
|---|---|
| 语言 | Go 1.27 |
| HTTP | 标准库 `net/http` + `chi` |
| 数据库 | PostgreSQL + `pgx` + `sqlc` + `golang-migrate` |
| 缓存/会话 | Redis + `go-redis` |
| 事件 | NATS JetStream |
| 内部通信 | ConnectRPC / gRPC |
| 外部契约 | REST + OpenAPI 3.1 |
| 可观测性 | `slog` + OpenTelemetry + Prometheus + Grafana + Jaeger |
| 本地编排 | Docker Compose |
| 前端 | React + Vite（后续接入，复用 v1 视觉参考） |

## 当前仓库结构

```text
dailywork/
├── old/          # v1 完整归档，只读参考
├── CLAUDE.md     # 协作说明
├── README.md     # 本文件
└── .gitignore
```

代码阶段的规划目录：

```text
services/   gateway, identity, task, planning, docs, assistant
api/        OpenAPI / Protobuf 契约
deploy/     Docker Compose, K8s manifests
web/        React SPA
docs/       本地只放索引；正式文档在飞书
```

## 文档

飞书知识库根节点：[开发](https://my.feishu.cn/wiki/HjuOwAe34iZPbmkzOJhcMYK1nb4)

| # | 文档 |
|---|---|
| 01 | [项目总览｜时序 v2](https://my.feishu.cn/wiki/ALRjwaoJxi88NNk7ttMca03cnEf) |
| 02 | [产品需求文档（PRD）｜时序 v2](https://my.feishu.cn/wiki/VBjjw4UdfisQpnk8YrZcesHLnvg) |
| 03 | [产品路线图与迭代计划｜时序 v2](https://my.feishu.cn/wiki/EpqawRh7din22ykpkXocPu17n5d) |
| 04 | [微服务架构总览｜时序 v2](https://my.feishu.cn/wiki/LrvQw8IlDiGKxSkw8SoceIsunWb) |
| 05 | [服务边界与数据归属｜时序 v2](https://my.feishu.cn/wiki/AmXswneqTiE6aZklphTcGHqAnle) |
| 06 | [数据模型与一致性｜时序 v2](https://my.feishu.cn/wiki/LM7bwpqfjiHdF7kAUxpczJ7qnkh) |
| 07 | [API 契约与网关｜时序 v2](https://my.feishu.cn/wiki/LcvjwjRJ9iVboYkNvucclMnWnEd) |
| 08 | [事件驱动与消息｜时序 v2](https://my.feishu.cn/wiki/TbDcw8OwTiR4T1kpcvFc56Eqnze) |
| 09 | [安全与账户体系｜时序 v2](https://my.feishu.cn/wiki/ZmTDwwY03iUAq1kjzolcKDuun0c) |
| 10 | [可观测性与运维｜时序 v2](https://my.feishu.cn/wiki/KCMuwU3aWivkUKkVXzxcUT37n4g) |
| 11 | [测试策略｜时序 v2](https://my.feishu.cn/wiki/NL76wH41OihPOGkFF6ocBrzQnTd) |
| 12 | [设计系统与页面规格｜时序 v2](https://my.feishu.cn/wiki/M2NZwqil8iJ5WKkvp74cnMqpnZx) |
| 13 | [ADR 决策记录｜时序 v2](https://my.feishu.cn/wiki/NJr6wRyuTiMzeEkHu79c8hoCnNg) |
| 14 | [研发流程与发布｜时序 v2](https://my.feishu.cn/wiki/CtWjwAwCwiYLIJkdPPPciEuDnbr) |

## v1 归档

- 旧代码、旧文档、设计资产、测试与部署配置全部在 [`old/`](old/)。
- `old/` 是冻结参考：不参与构建，不从中 import，不修改。
- v1 的完整历史在 `main` 分支与 `v0.2.0` tag；远端仓库：<https://github.com/inezhi/dailywork>。

## 工作方式

- `main` 只收 PR，不直接开发。
- `v2` 是 v2 集成分支；功能从 `v2` 切 `feat/<scope>`。
- 文档先行：产品与架构文档定稿后，再开始 M1 代码。
- 提交遵循 Conventional Commits。
