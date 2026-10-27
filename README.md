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
- 用 Kitex + Thrift 练内部 RPC，用 Hertz 做 HTTP 网关；
- 用 etcd 练服务注册与发现（M3），用 APISIX 练平台网关（M6）；
- Redis 会话/缓存、Kafka 事件流（分区、消费组、offset、重平衡）；
- 用 MongoDB 练文档型数据，用 Eino 练 Agent 编排与工具调用；
- OpenTelemetry 日志、指标、链路，以及 Docker Compose / K8s 部署；
- Go 的工程习惯：`context.Context`、显式错误、接口小、依赖注入、优雅退出、表驱动测试。

## 规划架构

```text
浏览器 / 未来移动端
        │ HTTPS
        ▼
   APISIX（M6 可选：TLS、限流、灰度、API Key）
        │
        ▼
   gateway (Hertz / BFF)
   ├── identity    账户、会话、验证码（Kitex）
   ├── task        空间、项目、任务、标签（Kitex）
   ├── planning    日历、容量、专注会话（Kitex，后续）
   ├── docs        文档、正文、反向链接（Kitex，MongoDB，后续）
   └── assistant   AI 对话、工具调用、流式输出（Kitex + Eino，MongoDB，后续）
        │
        ├── PostgreSQL（identity / task）
        ├── MongoDB（docs / assistant）
        ├── Redis（会话、缓存、限流）
        ├── Kafka（KRaft，领域事件）
        ├── etcd（服务注册/发现，M3）
        ├── MinIO（附件对象存储，后期）
        └── OpenTelemetry / Prometheus / Grafana / Jaeger（可观测性）
```

MVP 只实现 **gateway + identity + task**，跑通注册、登录、创建任务、今天列表；其余服务按路线图逐步拆出。M6 可选在 Hertz 前加 APISIX 做平台网关，Hertz 保留 BFF；BFF 聚合按需使用，不强制所有页面都走聚合接口。

## 规划技术栈

| 层 | 选型 |
|---|---|
| 语言 | Go 1.27 |
| HTTP 网关 | **Hertz**（兼 BFF） |
| 平台网关（M6 可选） | **APISIX**（TLS、限流、灰度、API Key） |
| 内部 RPC | **Kitex + Thrift** |
| IDL / 代码生成 | Thrift + `kitex` / `thriftgo` |
| 数据库 | PostgreSQL（identity / task）+ MongoDB（docs / assistant） |
| 数据访问 | PostgreSQL：`pgx` + `sqlc` + `golang-migrate`；MongoDB：`mongo-go-driver` |
| 缓存/会话 | Redis + `go-redis` |
| 事件 | **Kafka**（本地 KRaft 单节点；生产多 broker） |
| 服务发现 | M1 直连，M3 接 etcd（`kitex-contrib/registry-etcd`） |
| 外部契约 | REST + OpenAPI 3.1 |
| Agent 编排 | **Eino**（assistant 服务，工具调用 + 流式输出） |
| 对象存储 | MinIO（docs 附件，后续） |
| 可观测性 | `slog` + OpenTelemetry + Prometheus + Grafana + Jaeger |
| 本地编排 | Docker Compose |
| 前端 | React + Vite（后续接入，复用 v1 视觉参考） |

事件总线选 Kafka：本地 KRaft 单节点即可跑；分区、消费组、offset、重平衡是重点练习内容。

服务发现选 etcd：M1 先用 Compose 直连，M3 接 etcd（`kitex-contrib/registry-etcd`）；Kitex 通过 `Registry` / `Resolver` 抽象，后续可换 Consul、Nacos。

## MongoDB 与 Agent 框架

两者在 MVP 之后（M7 docs、M8 assistant）落地；MVP 仍然是 gateway + identity + task。原则是：**有明确场景才引入，不为了用而用。**

### MongoDB：只放文档型数据

- `docs` 服务：文档树、块正文 JSON、反向链接、文档搜索投影。文档天然是嵌套结构，MongoDB 的文档模型比关系表更自然。
- `assistant` 服务：对话、消息、工具调用轨迹、Agent 运行记录。消息是追加型文档，读写模式简单。
- **不用于** `identity`/`task`：账户、任务、项目、标签仍是 PostgreSQL；不做跨库 JOIN，不把任务数据复制到 Mongo。

### Eino：只用于多步 Agent 场景

- 「今天做什么」：读取今天任务 → 汇总压力 → 给出建议 → 用户确认后创建/调整任务。
- 「任务拆解」：读取任务 → 生成子任务 → 用户确认 → 调用 task 服务创建。
- 「周复盘」：读取已完成/逾期任务 → 生成复盘 → 提取下一步。
- Eino 负责图编排、工具调用、记忆和流式输出；简单单轮问答或纯文本润色直接调模型 SDK，不套 Agent 框架。
- 工具只读任务数据；写操作必须经用户确认并走 task 服务，Agent 不允许直写数据库。



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
services/   gateway(Hertz/BFF), identity/task/...（Kitex）
api/        OpenAPI / Thrift IDL / 生成代码
deploy/     Docker Compose, APISIX, Kafka, K8s manifests
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

## 参考项目

- [biz-demo](https://github.com/cloudwego/biz-demo) — 业务示例仓库：Hertz + Kitex、`hz`/`kitex` 代码生成、etcd 注册、GORM/MySQL、Hertz 中间件、OpenTelemetry。重点看工程接线和多服务拆分。
- [Wild Workouts](https://github.com/ThreeDotsLabs/wild-workouts-go-ddd-example) — Go DDD / Clean Architecture / CQRS 教学项目：领域分层、Repository、CQRS、微服务测试架构。重点看架构演进和测试方式。

两个仓库只作参考，不改变本项目的技术选型；我们仍使用 Kitex + Thrift、Hertz、Kafka、etcd、PostgreSQL + pgx/sqlc。

## v1 归档

- 旧代码、旧文档、设计资产、测试与部署配置全部在 [`old/`](old/)。
- `old/` 是冻结参考：不参与构建，不从中 import，不修改。
- v1 的完整历史在 `main` 分支与 `v0.2.0` tag；远端仓库：<https://github.com/inezhi/dailywork>。

## 工作方式

- `main` 只收 PR，不直接开发。
- `v2` 是 v2 集成分支；功能从 `v2` 切 `feat/<scope>`。
- 文档先行：产品与架构文档定稿后，再开始 M1 代码。
- 提交遵循 Conventional Commits。
