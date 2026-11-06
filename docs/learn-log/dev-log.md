# 开发学习日志

按层记录：每层解决什么问题、关键代码、必须记住的规则。

---

## 0. 整体结构

```
浏览器 ──HTTP/JSON──► gateway ──RPC/二进制──► task 服务 ──► MySQL
```

三个进程，两种协议，所以有两份契约。

---

## 1. 契约层

**问题：** 两块程序之间传什么，必须先约定好，否则字段名、类型对不上。

**两份契约：**

| 哪一段 | 协议 | 文件 |
|---|---|---|
| 浏览器 → gateway | HTTP + JSON | `api/openapi/v1/openapi.yaml` |
| gateway → task | RPC + 二进制 | `api/thrift/v1/dailywork.thrift` |

**Thrift 文件分工：**

```
api/thrift/v1/
├── base/base.thrift            公共结构 Base / BaseResp
├── const/task_const.thrift     枚举 TaskStatus / TaskPriority
├── model/task_model.thrift     领域对象 Task / TodayGroup / Today
└── dailywork.thrift            请求、响应、service
```

**规则：**

- 字段前的 `1:` `2:` 是字段编号，二进制靠它认字段。**发布后不复用、不重排，只能往后加。**
- `required` 必须传，`optional` 可以不传。
- 请求和响应都在 255 号字段放 `Base` / `BaseResp`。谁调的、追踪号、成功与否都在这里。
- 请求响应类型统一 `Req` / `Resp` 后缀。
- 创建任务不能传 `done`：完成只能走 `CompleteTask`。

**生成：**

```bash
make codegen        # thrift → api/gen/rpc，openapi → api/gen/http
make codegen-check  # 改契约忘提交生成代码时报警
```

生成代码不手改。

---

## 2. 数据库

**问题：** 数据存哪、怎么约束。

**三张表：**

| 表 | 作用 | 删除方式 |
|---|---|---|
| `spaces` | 任务的一级分组 | `deleted_at` 逻辑删除 |
| `projects` | 空间下的分组 | `archived_at` 归档 |
| `tasks` | 任务 | `deleted_at` 逻辑删除 |

**规则：**

- **不建外键。** 关联由应用层保证。
- **只逻辑删除，不做物理清理。** 查询一律过滤 `deleted_at IS NULL`。
- **状态和优先级存数字**：`status` 1=inbox … 6=done，`priority` 1=none … 5=urgent，与 Thrift 枚举编号一致。
- **枚举约束用 CHECK**：`CHECK (status BETWEEN 1 AND 6)`、`CHECK ((status = 6) = (completed_at IS NOT NULL))`。
- 活跃名称唯一用生成列 + 唯一索引（MySQL 没有部分索引）：`active_name = IF(deleted_at IS NULL, LOWER(name), NULL)`。

**建表方式：** `deploy/mysql/init/02-schema.sql`，容器首次启动自动执行。改表就改脚本 + `make down-v` 重建。

---

## 3. 领域层

**文件：** `services/task/internal/domain/task.go`

**问题：** 什么算合法的任务。

**`Task` 聚合根：**

- 字段全部小写，外部只能通过方法访问，不变量不会被绕过。
- 没有 `children` 字段。子任务也是 `Task`，用 `parentID` 关联，是两个聚合。

**值对象 `Title`：**

```go
type Title string
func NewTitle(s string) (Title, error)   // 校验：非空、≤200 字符
```

`Task.title` 的类型是 `Title`，不是 `string`。**不合法的标题造不出来**，因为只能通过 `NewTitle` 构造。

**两条创建/重建路径：**

```go
NewTask(params)        // 用户创建：跑全部校验
Reconstitute(...)      // 从数据库恢复：不跑校验
```

从库里读出来的数据当初就合法，不该重放业务规则。

**不变量（都在 domain 里守）：**

| 规则 | 守在哪 |
|---|---|
| 标题非空、≤200 **字符**（不是字节） | `NewTask` |
| 备注 ≤20000 字符 | `NewTask` |
| 预估 0–10000 | `NewTask` |
| 创建时不能是 `done` | `NewTask` |
| `done` 与 `completedAt` 同时成立 | `Complete` / `Reopen` |

```go
task.Complete(now)        // status=done 且写 completedAt
task.Reopen(StatusNext, now)  // 切回非 done 且清空 completedAt
```

时间由参数传入，不用 `time.Now()`，测试才能断言。

**测试：** 18 个用例，`go test ./services/task/internal/domain/`。

---

## 4. 应用层

**文件：** `services/task/internal/application/create_task.go`

**问题：** 创建一个任务要按什么顺序做哪几件事。

**三个接口（定义在应用层，实现在 adapters）：**

```go
TaskRepository interface { Save, FindByID }
IDGenerator    interface { NewID }
Clock          interface { Now }
```

**用例：**

```go
func (uc *CreateTask) Execute(ctx, in CreateTaskInput) (*domain.Task, error)
```

三步：

1. 带 `parentId` → 查父任务，继承它的空间与项目，拒绝"父任务本身是子任务"
2. 交给 `domain.NewTask` 校验并构造
3. `repo.Save` 落库

**归属：**

| 规则 | 放哪 | 为什么 |
|---|---|---|
| 标题长度、状态合法 | domain | 永远成立 |
| 子任务继承父任务空间 | application | 要读另一个聚合，聚合之间不能互相查 |
| ID 从哪来、何时存 | application | 编排 |

**测试：** 5 个用例，用假仓库（一个 map）和固定时钟，不连数据库。

---

## 5. 未完成

| 缺什么 | 补在哪 |
|---|---|
| GORM 实现 `TaskRepository` | adapters |
| `cmd/task/main.go`：连库、起 Kitex 服务 | 入口 |
| Kitex handler：`CreateTaskReq` → `CreateTaskInput` | adapters |
| gateway：Hertz 路由 + 调 RPC | gateway |
| 用到的 UUID 生成器、系统时钟实现 | adapters |
