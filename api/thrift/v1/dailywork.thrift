// 内部 RPC 的入口：所有请求、响应和 service 都在这个文件里。
// 领域对象在 model/，枚举在 const/，公共结构在 base/，这里只有传输结构和接口。
// 每个方法的请求紧接响应；255 号字段统一放 Base / BaseResp。
include "base/base.thrift"
include "const/task_const.thrift"
include "model/task_model.thrift"

namespace go rpc

// ===== 连通性检查 =====

// 验证调用链是否通：原样返回传入的 message，不做任何业务。
struct EchoReq {
  1: required string message

  255: required base.Base Base
}

struct EchoResp {
  1: required string message        // 原样返回，调用方据此确认内容没被改写

  255: required base.BaseResp BaseResp
}

// ===== 创建任务 =====

// HTTP 的 POST /api/v1/tasks 映射到这里。
// 三个默认值在服务端统一处理，各端不再各写一遍：
//   省略 spaceId  → 落到用户的"个人"空间
//   带 parentId  → 忽略 spaceId 与 projectId，继承父任务的空间与项目
//   省略 notes / status / priority → 分别为 "" / inbox / none
struct CreateTaskReq {
  1: required string userId          // 任务归属的用户；gateway 从内部 JWT 取出后填入，不接受客户端传
  2: required string title           // 任务标题，列表和今天页主要显示的就是它；1–200 字符
  3: optional string spaceId         // 任务所属空间，是任务的一级分组；省略用"个人"空间
  4: optional string projectId       // 任务所属项目，在空间之下；可空，表示只挂在空间上
  5: optional string parentId        // 父任务 id，用来建子任务；只允许一层，父任务自身不能再有父任务
  6: optional string notes           // 任务正文，纯文本；上限 20,000 字符，省略存空串
  7: optional task_const.TaskStatus status         // 省略为 INBOX；不接受 DONE，完成必须走 CompleteTask
  8: optional task_const.TaskPriority priority     // 优先级，只影响排序与视觉，不参与今天分组；省略为 NONE
  9: optional string scheduledDate   // 计划哪天做，YYYY-MM-DD；决定"今天计划"分组
  10: optional string dueDate        // 哪天必须交，YYYY-MM-DD；早于今天且未完成即为"逾期"
  11: optional i32 estimateMinutes   // 预估耗时，单位分钟，0–10,000；今天页用它算每组合计
  12: optional list<string> tagIds   // 要挂的标签；标签是用户级资源，不参与今天分组
  13: optional string idempotencyKey // 幂等键；同一用户同一 key 重复提交返回首次结果，不会建出两条

  255: required base.Base Base       // 调用上下文：logId、caller
}

struct CreateTaskResp {
  1: optional task_model.Task task   // 新建成功的任务，含服务端生成的 id 与 version=1

  255: required base.BaseResp BaseResp
}

// ===== 认证 =====
// 邮箱与手机号二选一：两个字段恰好传一个，两个都传或都不传由服务端拒绝。

// 发送验证码。开发环境不接真实邮件/短信，固定 2222 视为正确。
struct SendCodeReq {
  1: optional string email
  2: optional string phone

  255: required base.Base Base
}

struct SendCodeResp {
  1: required string channel       // 实际使用的渠道：email 或 phone

  255: required base.BaseResp BaseResp
}

// 注册：验证码确认邮箱/手机归属，密码只存 bcrypt 哈希。
struct RegisterReq {
  1: optional string email
  2: optional string phone
  3: required string code          // 验证码；开发环境固定 2222
  4: required string password      // 至少 8 位

  255: required base.Base Base
}

struct RegisterResp {
  1: required string userId

  255: required base.BaseResp BaseResp
}

// 登录：邮箱或手机号 + 密码，成功后签发 JWT。
struct LoginReq {
  1: optional string email
  2: optional string phone
  3: required string password
  4: optional string client        // web 或 desktop；空值按 web 处理
  5: optional string device        // 设备描述，gateway 从 User-Agent 取
  6: optional string ip            // 客户端 IP

  255: required base.Base Base
}

struct LoginResp {
  1: required string token         // JWT；网页端写 Cookie，桌面端放响应体
  2: required string userId
  3: required string expiresAt     // RFC3339

  255: required base.BaseResp BaseResp
}

// 登出：吊销会话，之后同一个 token 不再通过校验。
struct LogoutReq {
  1: required string sessionId

  255: required base.Base Base
}

struct LogoutResp {
  255: required base.BaseResp BaseResp
}

// 校验 JWT 与 session 状态，供 gateway 中间件调用。
struct ValidateSessionReq {
  1: required string token

  255: required base.Base Base
}

struct ValidateSessionResp {
  1: required string userId
  2: required string sessionId
  3: required string expiresAt     // RFC3339

  255: required base.BaseResp BaseResp
}

// ===== 完成任务 =====

// HTTP 的 POST /api/v1/tasks/{id}/complete 映射到这里。
// expectedVersion 必填：版本对不上返回冲突，避免两个页面同时改。
struct CompleteTaskReq {
  1: required string userId
  2: required string taskId
  3: required i32 expectedVersion

  255: required base.Base Base
}

struct CompleteTaskResp {
  1: optional task_model.Task task   // 成功时非空；业务错误时为空

  255: required base.BaseResp BaseResp
}

// ===== 今天 =====

// HTTP 的 GET /api/v1/today?date=YYYY-MM-DD 映射到这里。
// 日期由客户端传，服务端不用自己的时区推导"今天"。
struct ListTodayReq {
  1: required string userId
  2: required string date          // YYYY-MM-DD

  255: required base.Base Base
}

// 一个分组；组内任务按创建时间倒序。
struct TodayGroup {
  1: required task_const.TodayGroupKind kind
  2: required list<task_model.Task> tasks
  3: required i32 count            // 任务数，以服务端为准
  4: required i32 estimateMinutes  // 组内预估合计，以服务端为准
}

struct ListTodayResp {
  1: required list<TodayGroup> groups   // 固定六组，按优先级排序

  255: required base.BaseResp BaseResp
}

// ===== 服务 =====

// 只有一个 RPC 服务：gateway 通过它访问全部能力。
service DailyWorkService {
  // 连通性检查。部署后用一次调用确认 gateway ↔ 服务 的链路是通的，不做任何业务。
  EchoResp Echo(1: EchoReq req)

  // 创建任务。同一 userId + idempotencyKey 重复调用返回首次结果，不会建出两条。
  CreateTaskResp CreateTask(1: CreateTaskReq req)

  // 完成任务；状态与完成时间同时更新，并产生 task.completed 事件。
  CompleteTaskResp CompleteTask(1: CompleteTaskReq req)

  // 发送验证码；开发环境固定 2222。
  SendCodeResp SendCode(1: SendCodeReq req)

  // 注册账户。
  RegisterResp Register(1: RegisterReq req)

  // 登录，返回 JWT。
  LoginResp Login(1: LoginReq req)

  // 吊销会话。
  LogoutResp Logout(1: LogoutReq req)

  // 校验 JWT 与会话状态。
  ValidateSessionResp ValidateSession(1: ValidateSessionReq req)

  // 今天页：按客户端传来的日期分六组返回。
  ListTodayResp ListToday(1: ListTodayReq req)
}
