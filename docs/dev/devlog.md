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

**与 05 的偏差：** 05/06 写的是 identity 与 task 各一个库。服务已经合并成一个
`DailyWorkService`，本地先用单库 `dailywork`；等把服务拆回去时再分库。

**验证：** 三个容器都 healthy；MySQL 8.4.13，`dailywork` 账号能连；
3306 / 6379 / 9092 宿主机可达；`redis-cli ping` 返回 PONG。

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
