# 开发日志

> **规则：每次提交前更新这一篇。** 记三样：这一步做了什么、为什么这么做、踩了什么坑。
> 规格仍以飞书 14 篇为准；这里只记过程与判断，供以后复习。

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
`*string` 能区分 `nil`（没传）和 `&""`（传了空串）——这正是 `UpdateTaskRequest` 要的：**不传表示不修改，传空串表示清空。**

**⑤ `required` 的实际效果，别记错。**
它**不会**把 Go 字段变成值类型，字段仍然是指针。它约束的是线协议：

- 接收方反序列化后校验，字段缺失返回 `ProtocolException`；
- **发送方没有保护**，`nil` 直接 panic。所以 gateway 那边要有统一的出口去填 `Base`。

**⑥ 每个方法的请求都包成结构体。**
一开始只有 `CreateTask` / `UpdateTask` 有请求结构体，另外 5 个直接传参。问题：那 5 个方法没地方放 `Base`，`logId` 传不进去，日志断链。改成七个 `XxxRequest` 后签名统一，调用上下文在每个方法上都有位置。

### 3. 目录：三个 IDL 为什么放同一层

```
api/thrift/v1/{base,task,identity}.thrift
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

### 6. 提交记录

| 提交 | 内容 |
|---|---|
| `970723d` | 三份 IDL + 生成代码 + go.mod |
| `7240953` | 请求全部包成结构体、Base 改 required、按接口重排 |
| 本次 | OpenAPI 契约 + 生成类型 + 开发日志 |

### 7. 当前进度

- Gate 条件 3：对内（Thrift）✅、对外（OpenAPI）✅，生成均可复现
- 未做：`make codegen` 固化、CI 漂移检查、开发环境（colima + MySQL/Redis/Kafka）、切片 1
