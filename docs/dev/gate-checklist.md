# 开代码 Gate 前的清单

> 依据 CLAUDE.md：产品范围、服务边界、API 契约、数据模型没在飞书里写清楚之前，不开始实现。
> 用法：逐项打勾。标「未决」的是产品决定，不是文档工作量——它们没答案，写多少文档都会返工。
> 飞书 14 篇已于 2026-10-31 核对，见 [feishu-map.md](feishu-map.md)。

## A. 五个产品规则

结论已定，五条都已写进 PRD（2026-10-31）。详见 [decisions.md](decisions.md)。

| # | 问题 | 结论 | 写进 PRD |
|---|---|---|---|
| A1 | 完成父任务时，子任务跟着完成吗？ | 跟着完成，执行前二次确认 | [x] FR-T3 |
| A2 | 删除有子任务的任务，禁止还是级联？ | 级联，二次确认 | [x] FR-T4 |
| A3 | 重复任务进入下一轮，复制子任务吗？ | 复制 | [x] 写进非目标 |
| A4 | "今天"只看计划日期，还是回落到截止日期？ | 都看，分不同分组 | [x] FR-D2 |
| A5 | 归档后还出现在今天吗？ | 不出现 | [x] FR-T7 |

A3 和 A5 落地时各澄清了一件事：

- A3：v2.0 不做重复任务，写进了非目标；"下一轮复制子任务"留作将来加功能时的预设。
- A5：任务没有归档态，归档只作用于项目和空间；定的是"归档项目下的任务不进今天"。

## B. 飞书文档：M1 必须先定稿的 6 篇

其余 8 篇可以并行，不阻塞 M1。状态是"结构完整"，不等于"已定稿"——定稿是评审判断，不是字数。

- [ ] 02 PRD：结构完整，五条产品规则已补，待定稿
- [ ] 05 服务边界与数据归属：结构完整，未逐段核对
- [ ] 06 数据模型与一致性：结构完整，有 MySQL DDL，需补级联删除的取舍
- [ ] 07 API 契约与网关：结构完整，`cascade` 已补
- [ ] 08 事件驱动与消息：结构完整，`TaskCompleted` 扇出语义已补
- [ ] 13 ADR：结构完整，已补 ADR-0018 垂直切片

可并行、不阻塞：01 总览、03 路线图、04 架构总览、09 安全、10 可观测性、11 测试策略、12 设计系统、14 研发流程。

## C. 术语表补齐

现在 10 个词：Space、Project、Task、Subtask、Today、Status、Priority、Complete、Reopen、Archive。缺四类：

- [ ] `Tag`：标签与任务多对多，改名不动任务
- [ ] 时间字段：`scheduledDate` / `dueDate` / `estimateMinutes` / `actualMinutes` 各自是什么，互不替代
- [ ] `Today` 的判定规则——A4 已定，按 FR-D2 的六个分组写
- [ ] `Archived` 限定为项目级属性，不是任务状态（A5 已澄清）

写完同步到飞书。两处不能各说各的。

## D. 契约文件（M1 只要最小集）

- [ ] `api/openapi/v1/openapi.yaml`
  - 统一错误信封 `{data, error}`
  - `POST /api/v1/tasks`；`GET /api/v1/today`（第一刀只需要前者）
  - `Idempotency-Key`、`expectedVersion` 的约定
  - 完成接口的 `cascade` 参数（A1 定，已写进 07）
- [ ] `api/thrift/task/v1/task.thrift`：`CreateTask`、`GetToday`
- [ ] `api/thrift/identity/v1/identity.thrift`：`Register`、`Login`、`Verify`（第二刀才用）
- [ ] `api/events/task.events.v1/`：事件信封 + 5 个事件的 JSON Schema
- [ ] 生成代码进 `api/gen/`，CI 做漂移检查

判据：契约能生成代码，重新生成后 `git diff` 为空。

## E. 数据模型

- [ ] `task` 库 `tasks` 表：`id`、`owner_id`、`space_id`、`project_id`、`parent_id`、`title`、`status`、`completed_at`、`scheduled_date`、`due_date`、`priority`、`version`、`deleted_at`、创建/更新时间
- [ ] `task` 库 `outbox` 表
- [ ] `identity` 库 `users`、`sessions`
- [ ] 索引：今天查询、`parent_id`、`owner_id`
- [ ] 迁移文件放 `services/<name>/migrations/`，用 golang-migrate
- [ ] 不变量落到约束：`status='done'` 与 `completed_at` 的对应关系（已加 `chk_tasks_done`）
- [x] 定级联删除用事件还是批量 SQL（批量软删 + 物理清理靠外键，见 decisions.md D2）
- [x] 今天查询排除已归档项目下的任务（FR-T7，06 §9）

## F. M1 的四个切片

- [ ] 切片 1：`POST /tasks` → gateway → task → MySQL（鉴权先硬编码 `ownerID`）
- [ ] 切片 2：identity 注册登录 + JWT 校验
- [ ] 切片 3：`GET /today`
- [ ] 切片 4：完成任务 + outbox + Kafka

每个切片的验收四条：能演示、有测试、有指标、文档同步。

## G. 工程准备

- [ ] 目录骨架：`services/`、`api/`、`deploy/`
- [ ] `docker compose`：MySQL、Redis、Kafka（KRaft 单节点）
- [ ] `Makefile`：up / down / test / lint / migrate / codegen
- [ ] CI：gofmt、golangci-lint、单测、生成漂移
- [ ] 分支：`v2` 集成，`feat/*` 开发，`main` 只收 PR

## H. 开 Gate 的判定

三条都满足就可以开始：

1. A 组五个问题都有结论，并写进 PRD 和术语表。
2. B 组 6 篇在飞书定稿。
3. D 组第一刀的契约（`POST /tasks`）能生成代码。

再加一条自检：**能用一句话说清"第一刀做什么、怎么验收"。** 说不清，就还没准备好。

## 不用等的事

这些不阻塞 M1，别拿它们当拖延理由：

- 前端（React SPA）
- `docs` / `assistant` 服务
- OpenTelemetry、Grafana、告警（M6）
- APISIX（M6）
