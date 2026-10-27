# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 当前状态

**v2 文档阶段，业务代码尚未开始。** 在飞书 14 篇文档定稿前，不要写服务、数据库、前端或部署代码。当前仓库的可见内容只有：

```text
old/          # v1 完整归档，只读参考
CLAUDE.md     # 本文件
README.md     # 项目说明与文档入口
```

## 项目定位

时序 / Dailywork v2：个人任务 × 时间 × 知识工作台，同时是 **Go 微服务学习项目**。产品只服务一个用户，但架构按可独立部署的服务来设计，目的是练习服务边界、数据所有权、事件驱动、可观测性与容器化。

## 最重要的规则

1. **`old/` 是冻结参考。** 禁止修改、构建、import，或把旧 TypeScript 实现直接复制进新代码。可以阅读其 PRD、设计系统、数据模型、ops 契约与测试断言，作为新规格的参考。
2. **文档先行。** 产品范围、服务边界、API 契约、数据模型未在飞书文档中写清楚之前，不开始实现。实现与文档冲突时，先改文档再改代码。
3. **`main` 只收 PR。** 新工作从 `v2` 切 `feat/<scope>`；完成后合回 `v2`；发布时 `v2` → `main` 提 PR。不要直接提交 `main`。
4. **一个服务一个数据库。** 禁止跨服务读表；跨服务只走 API 或事件。MVP 允许三个服务共用一台 PostgreSQL 实例，但必须是不同的 database/schema，且代码里不出现跨库 JOIN。
5. **不要造分布式单体。** 强耦合的聚合放在同一个服务；只有确实需要独立生命周期、独立扩容或独立数据所有权时才拆服务。

## 规划技术栈

- Go 1.27，标准库 `net/http` + `chi`
- PostgreSQL + `pgx` + `sqlc` + `golang-migrate`
- Redis（会话、缓存、限流）
- NATS JetStream（领域事件）
- ConnectRPC / gRPC（服务间），REST + OpenAPI 3.1（对外）
- `slog` + OpenTelemetry + Prometheus + Grafana + Jaeger
- Docker Compose 本地编排；K8s 作为后期学习目标
- 前端：React + Vite，后续接入；视觉参考 `old/design/`

## 规划目录

```text
services/
  gateway/      # BFF：路由、鉴权、SSE、限流
  identity/     # 账户、会话、验证码、头像
  task/         # 空间、项目、任务、标签、速记
  planning/     # 日历、容量、专注
  docs/         # 文档、正文、附件
  assistant/    # AI 供应商、对话、流式输出
api/            # OpenAPI / Protobuf 契约
deploy/         # docker-compose, k8s, grafana, prometheus
web/            # React SPA
docs/           # 本地索引；正式文档在飞书
```

## Go 约定

- 每个入口在 `services/<name>/cmd/<name>/main.go`，业务在 `internal/`，不导出不必要的类型。
- `context.Context` 作为第一个参数贯穿调用链；所有阻塞操作必须可取消。
- 错误用 `fmt.Errorf("...: %w", err)` 包装；HTTP 层统一映射为错误信封，不把内部错误直接返回给客户端。
- 依赖通过构造函数注入；不要用全局数据库句柄或 init 里连库。
- 优雅退出：监听 SIGINT/SIGTERM，先停止接收请求，再关闭连接池与消息订阅。
- 配置从环境变量读取，启动时校验；密钥不写进仓库、不写日志。
- 时间戳统一 UTC ISO-8601；业务日期用客户端传入的 `YYYY-MM-DD`，不要用服务端时区推导“今天”。

## 契约与数据约定

- 对外 API 前缀 `/api/v1`；成功与错误都使用统一信封（`data` / `error`）。
- 变更类请求带 `Idempotency-Key`；服务端按 key 去重并返回首次结果。
- 任务等聚合带 `version`；更新可带 `expectedVersion`，冲突返回 `409 VERSION_CONFLICT`。
- 跨服务事件使用 outbox：业务写入与 outbox 记录同一事务；由后台投递到 NATS，消费者按事件 ID 幂等。
- 每个服务自己的迁移放在 `services/<name>/migrations/`；禁止一个服务改另一个服务的表。
- 附件后期进 MinIO，数据库只存元数据；不要往 PostgreSQL 里塞大 BLOB。

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

修改文档时使用 `lark-cli docs +update`，保留原文档 URL；架构图优先用飞书画板。README 中的文档链接必须与飞书节点保持一致。

## 常用命令

代码阶段尚未开始，以下命令是规划占位，暂不可用：

```bash
make dev          # docker compose up + 本地服务
make test         # go test ./... + 集成测试
make lint         # go vet + golangci-lint
make migrate      # 各服务迁移
```

当前可用的只有 Git 与文档命令。`old/` 下的 pnpm/Node 命令已失效，不要执行。

## 版本

v2 从 `2.0.0` 开始；MVP 完成后打第一个 tag。版本记录在飞书 14 文档的 CHANGELOG 小节维护，发布时同步更新 README。
