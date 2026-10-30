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

**定稿的判据**：每条都能回答"是"，且没有会改变实现的未决问题。三条里任何一条是"否"，
就不算定稿，先改文档再谈。

### 02 PRD

- [x] MVP 范围与非目标不互相矛盾（桌面端在范围内，Windows / Android / iOS 在非目标里）
- [x] 每条 FR 都有可验收的描述，没有"待定"
- [x] 术语表与 §6 字段规则一致（今天六组、状态六枚举、归档只在空间与项目上）

2026-10-31 定稿。判据 2 原本不成立：21 条 FR 里 12 条没有验收。已在 5.1–5.5 的验收段
逐条补齐（账户三态、空间归档、创建默认值、cascade、删除级联、归档不进今天、汇总、断线重连），
并修正 §4 范围表里"离线模式、多窗口"的标点歧义。

### 05 服务边界与数据归属

- [x] 三个服务各自拥有哪些表，能用一句话说清且不交叉
- [x] "禁止的交互"清单里没有 M1 需要、却还没定义的跨服务调用
- [x] 创建任务的跨边界流程，每一步都能在 07 找到对应接口

2026-10-31 定稿。判据 3 原先卡在"校验会话"找不到接口：07 §11 只有 `TaskService`。
现在 05 §4 写明 gateway 调 `ValidateSession`、不读 `sessions` 表，07 §11 补上
`IdentityService.ValidateSession` 的 Thrift 定义，两边对齐。

顺带闭合一条遗留：08 要求消费者维护 `processed_events`，但 gateway 没有表。已改为
只有写状态的消费者（task 的级联消费者、未来的 search）建这张表，SSE 消费者不落库，
表结构补进 06 §8。

### 06 数据模型与一致性

- [x] DDL 能直接跑在空库上，约束覆盖了不变量（`chk_tasks_done`、父任务一层、唯一索引）
- [x] 今天查询的 SQL 与 FR-D2 的六个分组一一对应
- [x] `outbox` 与幂等表的结构能支撑"业务写入与 outbox 同一事务"

2026-10-31 定稿，改了三处：

- `notes` 与 `projects.description` 从 `TEXT` 改为 `MEDIUMTEXT`。`TEXT` 的上限是
  65,535 **字节**，20,000 字符按 utf8mb4 最坏情况是 80 KB，插入会直接失败。
- 今天 SQL 的候选集补 `inbox`。PRD 说收件箱任务放进第 5 组（`next` 与 `inbox` 同组），
  原 SQL 只捞 `doing`/`next`，新建任务永远不出现在今天页。
- 补 `processed_events(event_id, consumer)` 表，并写明只有写状态的消费者建它。

### 07 API 契约与网关

- [x] 错误信封、分页、幂等键、版本冲突四条都在，且只有一种写法
- [x] 第一刀用到的 `POST /tasks`，请求与响应字段与 06 的列一一对应
- [x] 认证约定（Cookie / Bearer / `X-Client: desktop`）与 09 一致

2026-10-31 定稿，改了五处：

- 请求与响应补齐 `spaceId`、`parentId`、`notes` 与时间/标签字段，并写明三个默认值
  （省略 `spaceId` 落到"个人"空间、带 `parentId` 时继承父任务的空间与项目、省略
  `notes` 存空串）。原示例缺这三列，子任务根本建不出来。
- 列表响应的形状写死为 `data.items` + `data.page.nextCursor`；原来只说"用游标分页"，
  没说游标放哪。
- 错误码统一：示例里的 `TASK_NOT_FOUND` 改为表里的 `NOT_FOUND`，避免同一件事两种写法。
- 幂等键补"按用户隔离、保留 24 小时"，与 06 的 `idempotency_keys` 对齐。
- §11 的 Thrift 补齐 `UpdateTaskRequest`、`Today`、`DeleteTaskResponse`，并新增
  `IdentityService.ValidateSession`；原 IDL 引用了未定义类型，生成不了代码。

### 08 事件驱动与消息

- [x] 八个事件的 payload 与触发时机明确，`TaskCompleted` 的扇出语义与 02 FR-T3 一致
- [x] 消费者幂等与 DLQ 策略写得可执行，不是口号
- [x] 事件 schema 的版本策略与 topic 命名一致（`task.events.v1`）

2026-10-31 定稿。事件目录是 5 个 task 事件 + 3 个 project 事件，不是五个。改了四处：

- 新增 §6.1 失败与 DLQ：重试 3 次（1s/2s/4s）、业务性失败直接进 DLQ、消息头带
  `original-topic/partition/offset`、按原 key 重放。原来只有"失败进 DLQ"五个字。
- 幂等表归属写清：写状态的消费者用自己的库，SSE 消费者不落库。
- 补上自触发保护：消费者只处理 `cascade=true` 的事件，它补齐子任务时发出的事件
  `cascade` 为 `false`。
- 补 `task.reopened` 的 SSE 映射与"单实例"假设：多实例共用一个消费组会分摊分区，
  扩实例前必须先改成每实例独立 group 或加广播层。

### 13 ADR 决策记录

- [x] 每条 ADR 都说得出至少一个被放弃的替代方案
- [x] 没有两条 ADR 互相矛盾（0022 已被 0023 取代，索引表已标注）
- [x] 索引表的条数与正文一致

2026-10-31 定稿。23 条 ADR 对 23 行索引。判据 1 原本不成立：0001/0002/0003/0005/
0006/0007/0008/0009/0010/0012/0017 只写了后果，没有替代方案。已逐条补一句"曾考虑
X，最终因 Y 放弃"。另外两处对齐：0009 补一句仓库现有 `docs/dev/`（索引与决议，不是
规格），0010 标注已被 0021 部分取代。

可并行、不阻塞：01 总览、03 路线图、04 架构总览、09 安全、10 可观测性、11 测试策略、12 设计系统、14 研发流程。

## C. 术语表补齐

现在 10 个词：Space、Project、Task、Subtask、Today、Status、Priority、Complete、Reopen、Archive。缺四类：

- [x] `Tag`：标签与任务多对多，改名不动任务
- [x] 时间字段：`scheduledDate` / `dueDate` / `estimateMinutes` / `actualMinutes` 各自是什么，互不替代
- [x] `Today` 的判定规则——A4 已定，按 FR-D2 的六个分组写
- [x] `Archived` 限定为项目级属性，不是任务状态（A5 已澄清）

2026-10-31 已写进飞书 02 §6.1 术语表，共 15 条（原有 10 条 + 补的 4 类拆成 5 条）。
表里另有三条约束：今天页的六组判定顺序、归档的适用范围、四个时间字段互不替代。

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

当前进度（2026-10-31）：

| 条件 | 状态 |
|---|---|
| 1. 五条规则写进 PRD 和术语表 | **满足**：A 组已写进 PRD，术语表见 02 §6.1 |
| 2. 6 篇定稿 | **满足**：02 / 05 / 06 / 07 / 08 / 13 于 2026-10-31 逐条判定通过 |
| 3. 第一刀契约能生成代码 | **未满足**：`api/` 尚未创建，属性上属于实现 |

## 不用等的事

这些不阻塞 M1，别拿它们当拖延理由：

- 前端（React SPA）
- `docs` / `assistant` 服务
- OpenTelemetry、Grafana、告警（M6）
- APISIX（M6）
