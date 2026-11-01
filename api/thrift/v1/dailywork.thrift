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
  7: optional task_const.TaskStatus status         // 任务状态，决定它出现在哪个视图；省略为 INBOX
  8: optional task_const.TaskPriority priority     // 优先级，只影响排序与视觉，不参与今天分组；省略为 NONE
  9: optional string scheduledDate   // 计划哪天做，YYYY-MM-DD；决定"今天计划"分组
  10: optional string dueDate        // 哪天必须交，YYYY-MM-DD；早于今天且未完成即为"逾期"
  11: optional i32 estimateMinutes   // 预估耗时，单位分钟，0–10,000；今天页用它算每组合计
  12: optional list<string> tagIds   // 要挂的标签；标签是用户级资源，不参与今天分组
  13: optional string idempotencyKey // 幂等键；同一用户同一 key 重复提交返回首次结果，不会建出两条

  255: required base.Base Base       // 调用上下文：logId、caller
}

struct CreateTaskResp {
  1: required task_model.Task task   // 新建成功的任务，含服务端生成的 id 与 version=1

  255: required base.BaseResp BaseResp
}

// ===== 读取任务 =====

struct GetTaskReq {
  1: required string userId
  2: required string taskId

  255: required base.Base Base
}

struct GetTaskResp {
  1: required task_model.Task task

  255: required base.BaseResp BaseResp
}

// ===== 修改任务 =====

// 局部更新：只改传了的字段。optional 字段有两种含义：
//   字段缺省   → 不修改这一列
//   传空字符串 → 清空这一列（落库为 NULL）
struct UpdateTaskReq {
  1: required string userId
  2: required string taskId          // 要改的任务
  3: required i32 expectedVersion    // 客户端读到的版本号；与当前 version 不符时不写库，返回冲突
  4: optional string title
  5: optional string notes
  6: optional task_const.TaskStatus status         // 改成 DONE 时必须走 CompleteTask，不能直接改这个字段
  7: optional task_const.TaskPriority priority
  8: optional string projectId
  9: optional string parentId
  10: optional string scheduledDate
  11: optional string dueDate
  12: optional i32 estimateMinutes
  13: optional list<string> tagIds   // 传了就整体替换，不是增量追加

  255: required base.Base Base
}

struct UpdateTaskResp {
  1: required task_model.Task task   // 写回后的任务，version 已加一

  255: required base.BaseResp BaseResp
}

// ===== 完成任务 =====

struct CompleteTaskReq {
  1: required string userId
  2: required string taskId
  3: bool cascade = false            // false 只完成任务本身；true 一并完成未完成的子任务

  255: required base.Base Base
}

struct CompleteTaskResp {
  1: required task_model.Task task   // 完成后的任务，status=done，completedAt 已写入

  255: required base.BaseResp BaseResp
}

// ===== 重新打开任务 =====

struct ReopenTaskReq {
  1: required string userId
  2: required string taskId

  255: required base.Base Base
}

struct ReopenTaskResp {
  1: required task_model.Task task   // 重新打开后的任务，completedAt 已清空

  255: required base.BaseResp BaseResp
}

// ===== 删除任务 =====

struct DeleteTaskReq {
  1: required string userId
  2: required string taskId
  3: bool confirm = false            // 有子任务时必须为 true 才执行，否则只返回子任务数量

  255: required base.Base Base
}

struct DeleteTaskResp {
  1: required i32 affectedSubtasks   // 跟着一起软删的子任务数量；前端用来提示"已删除 N 个子任务"

  255: required base.BaseResp BaseResp
}

// ===== 今天视图 =====

struct ListTodayReq {
  1: required string userId
  2: required string date            // YYYY-MM-DD；服务端不用自己的时区推导"今天"

  255: required base.Base Base
}

struct ListTodayResp {
  1: required task_model.Today today

  255: required base.BaseResp BaseResp
}

// ===== 会话校验 =====

// 校验一次会话。网页端传 Cookie 里的令牌，桌面端传 Bearer 里的令牌，到这里没有区别。
// identity 用令牌的哈希比对 sessions 表，并检查是否过期。
struct ValidateSessionReq {
  1: required string sessionToken    // 原始令牌，不是哈希；identity 自己算哈希去比对

  255: required base.Base Base
}

// 校验通过时返回的三项。只返回调用方用得上的信息，
// 不返回密码哈希、邮箱、验证码等与鉴权无关的字段。
struct ValidateSessionResp {
  1: required string userId          // 会话归属的用户
  2: required string username        // 显示用；gateway 写日志、放进响应
  3: required string expiresAt       // 会话过期时间，UTC ISO-8601；gateway 可据此决定 Cookie 的 Max-Age

  255: required base.BaseResp BaseResp
}

// ===== 服务 =====

// 只有一个 RPC 服务：gateway 通过它访问全部能力。
service DailyWorkService {
  // 连通性检查。部署后用一次调用确认 gateway ↔ 服务 的链路是通的，不做任何业务。
  EchoResp Echo(1: EchoReq req)

  // 创建任务。同一 userId + idempotencyKey 重复调用返回首次结果，不会建出两条。
  CreateTaskResp CreateTask(1: CreateTaskReq req)

  // 按 id 读取。任务不存在或已软删除时返回 NOT_FOUND。
  GetTaskResp GetTask(1: GetTaskReq req)

  // 局部更新，靠 expectedVersion 做乐观锁；版本对不上时返回冲突，不写库。
  UpdateTaskResp UpdateTask(1: UpdateTaskReq req)

  // 完成任务：status 置 done 并写 completedAt。
  // cascade=false 只动任务本身；true 时一并完成未完成的子任务，已完成的保持不变。
  // 联动在消费者里按子任务逐个开事务，不在父任务的聚合内完成，所以中间态可见。
  CompleteTaskResp CompleteTask(1: CompleteTaskReq req)

  // 重新打开：从 done 回到非 done 状态，同时清空 completedAt。
  ReopenTaskResp ReopenTask(1: ReopenTaskReq req)

  // 软删除，写 deleted_at，保留 30 天后物理清理。
  // 有子任务且 confirm=false 时不删，返回子任务数量让前端来确认；
  // confirm=true 时父子在同一事务里一起软删，不留孤儿。
  DeleteTaskResp DeleteTask(1: DeleteTaskReq req)

  // 今天视图。date 由客户端传入，服务端不推导"今天"；归档项目下的任务不进任何分组。
  ListTodayResp ListToday(1: ListTodayReq req)

  // 校验会话。令牌不存在、已过期或已注销时返回未认证，gateway 映射成 401 UNAUTHORIZED。
  // 这是 gateway 鉴权的唯一入口：gateway 不读 identity 的库，也不自己解析会话。
  ValidateSessionResp ValidateSession(1: ValidateSessionReq req)
}
