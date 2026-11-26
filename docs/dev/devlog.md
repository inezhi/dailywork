# 开发日志

> **规则：每次提交前更新这一篇。** 记三样：这一步做了什么、为什么这么做、踩了什么坑。
> 规格仍以飞书 14 篇为准；这里只记过程与判断，供以后复习。

---

---

## 阶段 1 · 本地环境（2026-11-02）

**目标：** 切片 1 之前把中间件跑起来。

- **colima**：`colima start --cpu 4 --memory 8`，然后把 docker context 切到 `colima`
  （默认 context 指向 `/var/run/docker.sock`，连不上）
- **`deploy/docker-compose.yml`**：`mysql:8.4`、`redis:7.4-alpine`、
  `apache/kafka:3.9.0`（KRaft 单节点，没有 ZooKeeper）
- **一个库一个账号**：库 `dailywork`、账号 `dailywork`，首次由
  `deploy/mysql/init/01-databases.sh` 创建；改了这个脚本要 `make down-v` 重建才生效
- **密码**：放 `deploy/.env`（gitignored），仓库里只有 `.env.example`
- **命令**：`make up / down / down-v / ps`

**单库是设计，不是临时妥协：** 从头到尾只有一个 MySQL 库 `dailywork`，不按服务分库。
05/06 里"每个服务一个库"的旧写法已经改掉。

**验证：** 三个容器都 healthy；MySQL 8.4.13，`dailywork` 账号能连；
3306 / 6379 / 9092 宿主机可达；`redis-cli ping` 返回 PONG。

---

## 阶段 2 · 切片 1（2026-11-05 起）

**库表决定：不建外键，任务只做逻辑删除。**

- 全库不建外键，跨表一致性由应用层保证；外键列该有的索引照建
- 任务只做逻辑删除（写 `deleted_at`），**不做物理清理**，所以也没有
  `ON DELETE CASCADE` 要处理——之前 06 里"30 天后物理清理"的写法已经删掉
- 删除父任务仍是一条 `UPDATE ... WHERE id = ? OR parent_id = ?`，父子写同一时间戳

**空间改成删除，不再是归档。** 空间去掉 `color`，`archived_at` 换成 `deleted_at`，
生成列 `active_name` 也改为按 `deleted_at` 判断。删除空间时连同其下任务一起逻辑删除
（二次确认，父子写同一时间戳），不做物理清理。归档只剩项目一个适用对象。

**项目去掉起止日期。** `projects` 只保留名称、描述、颜色与归档时间；飞书 02 的范围表
与 FR-P1 一并删掉"起止日期"，ER 图同步。02 里提到的项目"状态"在表里本来就没有，也一起去掉了。

**状态与优先级存数字。** `tasks.status` / `tasks.priority` 从 VARCHAR 改成 TINYINT，
编号与 `const/task_const.thrift` 一一对应：状态 1=inbox…6=done，优先级 1=none…5=urgent。
CHECK 改成范围校验（1–6、1–5），`chk_tasks_done` 相应写成 `status = 6`。
好处是数据库、Thrift、Go 常量共用一套编号，少一次字符串映射。

**切片 1 的代码（第一步）：** 领域层 `domain/task.go`（Task 聚合、Title/Status/Priority、
NewTask、Reconstitute、Complete/Reopen）与应用层 `application/create_task.go`（三个接口 +
CreateTask 用例）已写完，23 个测试通过，不依赖数据库。

两个取舍记一下：仓储接口一度移到 domain 又移回 application——偏好"接口跟用例走"；
Title 值对象与 Task 放在同一个文件——Go 不强制一文件一类型，按阅读方便来。

**建表不走迁移工具。** 建表脚本放 `deploy/mysql/init/02-schema.sql`，MySQL 容器首次启动
（数据卷为空）时自动执行，没有版本号、没有 up/down。改了脚本要 `make down-v` 重建数据卷
才生效——本地开发，能重建就不需要迁移。

**验证：** 空卷重建后三张表自动建好，`information_schema` 里 FOREIGN KEY 数量为 0，
三条 CHECK 约束都在。ER 图见 [`docs/dev/er.md`](er.md)。

**契约收口。** IDL 和 OpenAPI 只保留 `Echo` 与 `CreateTask`，没实现的方法和没人用的
struct 全部删掉，`api/gen` 跟着删掉七千多行。契约跟着实现走，不提前占位：占位的方法
没有实现，生成的接口会逼着写一堆空壳。

**`CreateTaskResp.task` 从 required 改成 optional。** 冒烟测试打出来的坑：业务出错时
`task` 是 nil，required 字段序列化失败，客户端收到的是 nil 响应，看不到 `BaseResp`
里的 400 和错误信息。改成 optional 后错误能正常带回。

**适配层（MySQL）。** `taskRow` 对应 `tasks` 表；`TaskRepo` 实现 `application.TaskRepository`。
`Save` 走乐观锁：`UPDATE ... WHERE id = ? AND version = ?`，`RowsAffected` 为 0 时再按
id 数一次——数到是版本冲突，数不到是新任务，走 INSERT。`FindByID` 过滤
`deleted_at IS NULL`，把 `gorm.ErrRecordNotFound` 翻成 `domain.ErrTaskNotFound`。
集成测试用 `TEST_MYSQL_DSN` 门控，没设置就跳过。领域层因此补了
`ErrTaskNotFound`、`ErrVersionConflict` 两个错误。

**适配层（Kitex）。** handler 只做三件事：`CreateTaskReq` → `CreateTaskInput`、调用用例、
结果或错误 → `CreateTaskResp`。业务错误走 `BaseResp.statusCode`：400 校验失败、
404 找不到、409 版本冲突、500 其它。日期用 `YYYY-MM-DD` 字符串，枚举用 int32，
指针字段用来区分"没传"和"零值"。

**入口。** `cmd/task/main.go` 一条线：读配置 → 连库 → 设连接池 → ping → 装配
仓储/用例/handler → 起 Kitex → 等信号 → 优雅停止。日志用 `slog` JSON 输出到 stdout。

**冒烟结果。** 服务起在 `127.0.0.1:8888`：`Echo` 返回 0；`CreateTask` 返回 0 且
`version=1`；空标题返回 400「标题不能为空」；MySQL 里能查到对应行。

**验证：** `go build ./...`、`go vet ./...` 通过；domain / application / mysql 三个包
测试全绿；`make codegen` 重复执行，`api/gen` 哈希不变。

**配置改成 YAML（2026-11-23）。** 服务的 `server.addr` 与 `mysql.dsn` 从环境变量搬进
`deploy/task.yaml`，用 `-config` 指定路径，启动时校验两项都非空。模板
`deploy/task.example.yaml` 进仓库，含密码的 `task.yaml` 走 gitignore——和 `.env` 同一套路子。
`gopkg.in/yaml.v3` 原本是 thriftgo 带进来的间接依赖，提升为直接依赖，没有新增模块。

**本地调用工具（2026-11-23）。** 新增 `tools/cli`：每个接口一个子命令，创建任务的参数用
flag 传，Echo 只收一个位置参数。它用 `api/gen` 里的类型构造请求，不经过 gateway。
Kitex 走 Thrift 二进制协议，没有 curl 的等价物，所以需要这个工具；gateway 写出来之后
HTTP 才能调。用法见 [`cli.md`](cli.md)。实测 Echo 与 CreateTask 都返回 0，任务数据落库。

**文档同步。** README 与 CLAUDE.md 的「当前状态」「仓库结构」改成实际进度；
`docs/dev/README.md` 的索引加入 `cli.md`。

**gateway 第 1 步（2026-11-23）。** 新建 `services/gateway/cmd/gateway/main.go` 与
`deploy/gateway.yaml`：Hertz 监听 `127.0.0.1:8080`，只注册 `GET /healthz`
（返回 `{"status":"ok"}`），配置结构与 task 服务一致（YAML + `-config`）。
`gateway.yaml` 不含密码，直接提交；`task.yaml` 继续走 gitignore。
引入 `hertz v0.10.6`，连带 `netpoll` 从 v0.7.2 升到 v0.7.5。

**gateway 第 2 步（2026-11-23）。** `deploy/gateway.yaml` 增加 `task.addr`；启动时用 Kitex
客户端调一次 `Echo` 验证链路，调用失败或 `statusCode` 非 0 都直接退出——和 task 服务启动时
ping 数据库是同一个原则：下游不通就不对外服务。RPC 超时 3 秒。还没注册业务路由。

**gateway 第 3 步（2026-11-23）。** 新增 `internal/adapters/hertz/echo.go`：`POST /api/v1/echo`
的解析、契约校验（message 1–200 字符）、RPC 调用与 `{data, meta}` 响应。每个响应生成 UUIDv7
作为 `requestId`，同时写 `X-Request-Id` 头，两者保持一致。错误先用 `ErrorEnvelope` 返回
400/500，完整的 domain 错误映射留给第 5 步。

**gateway 第 4 步（2026-11-23）。** 新增 `internal/adapters/hertz/create_task.go` 与
`convert.go`：`POST /api/v1/tasks` 完成 HTTP ↔ Thrift 的字段映射（UUID、日期、时间、
状态与优先级枚举）。gateway 做契约级校验：title 1–200、notes ≤ 20000、status 不能是 done、
priority 只能五个值、estimate 0–10000。`userId` 暂时写死 `u-local`，RPC 错误暂时一律 500，
分别在后面两步处理。

**gateway 第 5 步（2026-11-23）。** 契约给 `POST /api/v1/tasks` 补了 404 响应——父任务不存在时
服务端会返回 404，原契约没声明。新增 `errors.go`：把 task 服务的 `statusCode` 映射成 HTTP
状态码与错误码，400/404/409 原样保留，其余按 500。网络层错误不经过 `statusCode`，仍返回 500。

**gateway 第 6 步（2026-11-23）。** `ownerID` 从代码里写死改成配置 `auth.owner_id`，
`CreateTask` 构造时注入；缺这个字段启动直接报错。用临时配置验证过数据库里的 `user_id`
跟着配置变。切片 2 接入会话后删掉这段配置。

**gateway 第 7–8 步（2026-11-23）。** 新增 `handler_test.go` 与 `convert_test.go`：用假的
RPC 客户端和 Hertz 的 `ut.PerformRequest` 在内存里发请求，共 15 个用例，不依赖真实服务和
数据库。curl 演示通过：Echo 回显正常，创建任务返回 200 并落库。

**切片 1 收尾。** 八步全部完成：入口 → RPC 客户端 → Echo 路由 → CreateTask 路由 → 错误映射 →
ownerID 配置 → 测试 → 提交。验收四项里「能演示」「有测试」「文档同步」满足。
「有指标」**明确延期**：M1 四刀不包含可观测性建设，指标随 OpenTelemetry / Prometheus 一起在
可观测性里程碑补上——这是决定，不是遗漏。

另：**开发过程中禁止删除任何分支**，合并后也保留功能分支。这条已写进 CLAUDE.md 与 README。

**切片 2 第 1 步：认证契约（2026-11-24）。** Thrift 增加 `SendCode` / `Register` / `Login` /
`Logout` / `ValidateSession` 五个方法与对应请求响应；邮箱与手机号用两个独立字段、二选一，
不靠格式猜类型。OpenAPI 增加四条认证路径（codes / register / login / logout），登录支持
`X-Client: desktop` 换 Bearer token；所有 `description` 改为英文。生成代码后为了让服务继续
编译，新增 `auth_stub.go` 五个返回 500 的临时桩，gateway 测试的假客户端补了对应空方法。

**切片 2 第 2 步：users / sessions 建表（2026-11-24）。** 两张表加进 `02-schema.sql`：
users 的邮箱与手机号各自唯一、CHECK 保证至少有一个，另有头像与会员等级；sessions 一行一次
登录，带设备、IP、过期与吊销。对运行中的库手动执行了两条 `CREATE TABLE`，没有清数据；
`make down-v` 从空卷重建时脚本也会建出这两张表。

**切片 2 第 3a 步：identity 领域与应用层（2026-11-24）。** 新增 `services/identity/internal/domain`
与 `application`：Email/Phone 值对象、User 聚合，SendCode 与 Register 两个用例，以及五个端口
（UserRepository、VerificationCodeStore、PasswordHasher、IDGenerator、Clock）。验证码固定 2222、
TTL 5 分钟；密码 8–72 字节。18 个测试全部用假实现，不依赖 MySQL/Redis；适配器与接线留给 3b。

**切片 2 第 3b 步：identity 适配器与接线（2026-11-24）。** 新增 MySQL 用户仓储（唯一键冲突按
索引名翻译成邮箱/手机号已注册）、Redis 验证码存储（`SET EX` / `GETDEL`，前缀 `auth:code:`）、
bcrypt 哈希器；RPC 的 `SendCode` / `Register` 换成真实实现，`Login` / `Logout` / `ValidateSession`
仍为桩。`task.yaml` 增加 `redis` 段，启动时连 Redis 并 ping。实测注册成功并落库、重复注册 409、
错误验证码 400，Redis 里的验证码 TTL 为 300 秒。

**目录调整。** Go 的 `internal` 规则禁止 `services/task` import `services/identity/internal`，
identity 的 `domain` / `application` / `adapters` 上移一层，脱离 `internal`；task 的内部代码不变。

---

## 阶段 0 · 契约（2026-10-31 ~ 2026-11-02）

**目标：** 闭合 Gate 条件 3 —— 第一刀的契约能生成代码，重新生成后 `git diff` 为空。

### 1. 工具链

| 工具 | 版本 | 用途 |
|---|---|---|
| `thriftgo` | 0.4.5 | Thrift 编译器，把 `.thrift` 编成 Go |
| `kitex` | v0.16.3 | RPC 代码生成：调 thriftgo 出结构体，自己再出 client/server |
| `oapi-codegen` | v2.8.1 | OpenAPI → Go 类型与 HTTP 接口 |

装在 `~/go/bin`，本来就在 PATH 里。

**一个反直觉的点：** kitex 从 v0.12 起把 thriftgo 内嵌了，只装 kitex 也能生成 Thrift 代码。thriftgo 单独留着是为了直接跑命令调试、以及加载第三方生成插件。

### 2. 契约设计里绕不开的几个决定

**① 为什么是 255 号字段。**
公共结构 `Base` / `BaseResp` 固定放在结构体的 255 号位，业务字段一律从 1 开始编号。这样两个结构体的尾部永远一致，加业务字段不会撞号。**255 是位置约定，不是错误码。**

**② `Base` 和 `BaseResp` 不是一回事。**

| 结构 | 位置 | 内容 |
|---|---|---|
| `Base` | 请求的 255 | 调用上下文：`logId`、`caller` |
| `BaseResp` | 响应的 255 | 处理结果：`statusCode`、`statusMessage` |

**③ 为什么不把每个返回都包成 `{code, message, data}`。**
Thrift 的失败走异常，成功就是没有异常；再塞一个 `code` 字段会让每个方法都失去具体返回类型，调用点还得先拆信封。Kitex 另有 `bizstatuserr` 走协议头，我们没用——选了 `BaseResp`，因为它跨语言、跨协议都能读到，日志里也直接看得见码。

**④ `optional` 在 Go 里是指针，这是有语义的。**
`*string` 能区分 `nil`（没传）和 `&""`（传了空串）——这正是 `UpdateTaskReq` 要的：**不传表示不修改，传空串表示清空。**

**⑤ `required` 的实际效果，别记错。**
它**不会**把 Go 字段变成值类型，字段仍然是指针。它约束的是线协议：

- 接收方反序列化后校验，字段缺失返回 `ProtocolException`；
- **发送方没有保护**，`nil` 直接 panic。所以 gateway 那边要有统一的出口去填 `Base`。

**⑥ 每个方法的请求都包成结构体。**
一开始只有 `CreateTask` / `UpdateTask` 有请求结构体，另外 5 个直接传参。问题：那 5 个方法没地方放 `Base`，`logId` 传不进去，日志断链。改成七个 `XxxReq` 后签名统一，调用上下文在每个方法上都有位置。

### 3. 目录：三个 IDL 为什么放同一层

```
api/thrift/v1/
├── base/base.thrift
├── const/task_const.thrift
├── model/task_model.thrift
└── dailywork.thrift
```

原本按服务分目录（`api/thrift/task/v1/`），但 `include "base.thrift"` 需要编译器带 `-i` 找路径。编辑器（CodeBuddy）的内置检查没有这个参数，报了一串 "Unknown type 'base.BaseResp'"。合并到同目录后，编辑器和 thriftgo 都能按相对目录直接找到。

代价：偏离了原文档的 `api/thrift/<service>/v1/` 约定，已同步改 CLAUDE.md 与飞书 07。

### 4. 生成链路

**Thrift → Go：**

```bash
kitex -module github.com/inezhi/dailywork -gen-path api/gen api/thrift/v1/task.thrift
```

每个服务生成 6 个文件：结构体（`task.go`）、编解码（`k-task.go`）、常量、以及 `taskservice/` 下的接口 / client / server。

**OpenAPI → Go：**

```bash
oapi-codegen -config api/openapi/oapi-codegen.yaml api/openapi/v1/openapi.yaml
```

产物 `api/gen/http/v1/api.gen.go`：模型、`ServerInterface`、`Handler`。

### 5. 踩过的坑

| 现象 | 原因 | 处理 |
|---|---|---|
| CodeBuddy 报 8 个 Unknown type | 编辑器不认 `include` 搜索路径 | IDL 合并到同一目录 |
| YAML 解析失败 `line 92` | `X-Client: desktop` 里的冒号没加引号 | 整行加单引号 |
| 生成文件跑到了仓库外 | `output` 相对 CWD，不是相对配置文件 | 改成仓库根相对路径 `api/gen/...` |
| `go build` 突然报 `tmp/gen2` 找不到包 | 用 `/tmp/gen2` 做漂移对比时，kitex 按仓库内相对路径生成了 `tmp/gen2/` | 删除并重新生成 |
| 编译少 `oapi-codegen/runtime` | 生成的代码依赖运行时包 | `go mod tidy` |

### 6. 契约修订：删冗余、对齐强度

审计契约时发现三处冗余，改完重新生成、`go build` 通过：

| 问题 | 处理 |
|---|---|
| `meta.version` 与 `data.version` 是同一个值 | 删掉 `meta.version`，`Meta` 只剩 `requestId` |
| `meta` 声明为可选，但文档要求每个成功响应都带 | 三个信封改成 `required: [data, meta]` / `[error, meta]`；生成后 `Meta` 是值类型，漏填编不过 |
| `tagIds` 生成成 `*[]UUID`（指向切片的指针） | 加 `x-go-type-skip-optional-pointer: true`，变成 `[]UUID` |

同时把两层的契约强度对齐：Thrift 的 `status` / `priority` 从 `string` 改成
`enum TaskStatus` / `enum TaskPriority`，和 OpenAPI 的枚举一致。原来是字符串，
服务端返回一个 `done2`，没有任何一层会拦。

`TodayGroup.count` / `estimateMinutes` 保留（将来 tasks 可能被截断，这两个是唯一来源），
但在两个契约里都注明"以服务端为准，别拿 `len(tasks)` 代替"。

IDL 按**种类**分目录：`base/` 公共结构、`const/<domain>_const.thrift` 枚举、
`model/<domain>_model.thrift` 领域对象。**请求、响应和所有 service 都写在入口文件
`dailywork.thrift` 里**——model 里不出现 Req / Resp，接口和数据分开。类型名统一用 `Req` / `Resp` 简写
（`CreateTaskReq`、`CreateTaskResp`），OpenAPI 的 schema 也同名，不写全称。

入口文件里只有一个 `DailyWorkService`，所有方法（Echo、七个任务方法、会话校验）都在里面，
gateway 只连一个 RPC 进程。**这是相对 05 服务边界的简化**：identity 与 task 暂时跑在同一个
进程里，数据库仍按 05 分开，等真正需要独立部署或扩容时再拆成两个 service。

`Echo` 只把传入的 message 原样返回，用来确认 gateway ↔ 服务 的链路通不通，不做任何业务。
对外也开了一个 `POST /api/v1/echo`（message 放在请求体里），它和 `/healthz` 分工不同：后者只证明进程活着，
前者会一路调到 RPC 服务，能区分“网络断了”和“业务代码挂了”。

`dailywork.thrift` 用 include 的文件名前缀引用类型，例如 `task_model.Task`、`base.Base`。
include 写相对路径，从**源文件所在目录**算起：`model/task_model.thrift` 里写
`include "../const/task_const.thrift"`，`dailywork.thrift` 里写 `include "model/task_model.thrift"`。
thriftgo 不需要 `-I`。

注意：目录分层后，编辑器的 include 解析更容易失效——它只按当前文件所在目录找，未必认 `../`。
如果 CodeBuddy 报未知类型，那不是契约写错，以 `kitex` 跑通、`go build` 通过为准。

**一条工作方式的变更：** 契约文件（`api/openapi/*.yaml`、`api/thrift/*.thrift`）是实现时的准，
飞书同步过去。发现契约有问题就直接改，再回写文档——飞书不是不可改的。

**创建不能直接是 done：** 数据库有 `chk_tasks_done`（`status='done'` 时 `completed_at` 必须非空），
但创建请求里没有 `completedAt`。契约改为禁止：OpenAPI 用 `CreateTaskStatus`（五个值，去掉 done），
传 done 返回 400；完成只有 `CompleteTask` 一条路，`completedAt` 的来源唯一。

**契约收口：** `servers` 改成相对路径 `/`，生成的客户端跟着当前域名走，不写死 localhost；
所有 schema 统一 `additionalProperties: false`，只有 `ErrorBody.details` 保留 `true`——它本来就是自由字段。

外部接口补了 `GET /api/v1/echo`，它和 `/healthz` 分工不同：后者只证明 gateway 进程活着，
前者会一路调到 RPC 服务，能区分"网络断了"和"业务代码挂了"。

**生成命令固化：** 新建 `Makefile`，`make codegen` 跑两条命令（kitex + oapi-codegen），
`make codegen-check` 重新生成后 `git diff --exit-code -- api/gen`，有漂移就失败。
CI 的漂移检查直接复用这个目标。

kitex 已经内嵌 thriftgo，所以只需要装 kitex 与 oapi-codegen 两个工具，
版本钉在 Makefile 头部注释里。

### 7. 提交记录

| 提交 | 内容 |
|---|---|
| `970723d` | 三份 IDL + 生成代码 + go.mod |
| `7240953` | 请求全部包成结构体、Base 改 required、按接口重排 |
| 本次 | OpenAPI 契约 + 生成类型 + 开发日志 |

### 8. 当前进度

- Gate 条件 3：对内（Thrift）✅、对外（OpenAPI）✅，生成均可复现
- 未做：`make codegen` 固化、CI 漂移检查、开发环境（colima + MySQL/Redis/Kafka）、切片 1
