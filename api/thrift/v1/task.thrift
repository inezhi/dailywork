// task 服务的内部契约。浏览器看不到这个文件，gateway 和 task 之间用它约定字段。
// 这个服务管三样东西：空间（Space）、项目（Project）、任务（Task）。
// 层级是 空间 → 项目 → 任务；任务可以再挂一层子任务，子任务只允许一层。
// 字段编号即线协议：发布后不复用、不重排，新增字段只能往后追加。
// 每个方法的请求与响应写在一起；255 号字段统一放 Base / BaseResp。
// 字段的业务规则见飞书 07 §11（契约）与 06（tasks 表）。
include "base.thrift"

namespace go task

// ===== 创建任务 =====

// HTTP 的 POST /api/v1/tasks 映射到这里。
// 三个默认值在服务端统一处理，各端不再各写一遍：
//   省略 spaceId  → 落到用户的"个人"空间
//   带 parentId  → 忽略 spaceId 与 projectId，继承父任务的空间与项目
//   省略 notes / status / priority → 分别为 "" / inbox / none
struct CreateTaskRequest {
  1: required string userId          // 任务归属的用户；gateway 从内部 JWT 取出后填入，不接受客户端传
  2: required string title           // 任务标题，列表和今天页主要显示的就是它；1–200 字符
  3: optional string spaceId         // 任务所属空间，是任务的一级分组；省略用"个人"空间
  4: optional string projectId       // 任务所属项目，在空间之下；可空，表示只挂在空间上
  5: optional string parentId        // 父任务 id，用来建子任务；只允许一层，父任务自身不能再有父任务
  6: optional string notes           // 任务正文，纯文本；上限 20,000 字符，省略存空串
  7: optional string status          // 任务状态，决定它出现在哪个视图；见下方取值，省略为 inbox
  8: optional string priority        // 优先级，只影响排序与视觉，不参与今天分组；省略为 none
  9: optional string scheduledDate   // 计划哪天做，YYYY-MM-DD；决定"今天计划"分组
  10: optional string dueDate        // 哪天必须交，YYYY-MM-DD；早于今天且未完成即为"逾期"
  11: optional i32 estimateMinutes   // 预估耗时，单位分钟，0–10,000；今天页用它算每组合计
  12: optional list<string> tagIds   // 要挂的标签；标签是用户级资源，不参与今天分组
  13: optional string idempotencyKey // 幂等键；同一用户同一 key 重复提交返回首次结果，不会建出两条

  255: required base.Base Base       // 调用上下文：logId、caller
}

struct CreateTaskResponse {
  1: required Task task              // 新建成功的任务，含服务端生成的 id 与 version=1

  255: required base.BaseResp BaseResp
}

// ===== 读取任务 =====

struct GetTaskRequest {
  1: required string userId
  2: required string taskId

  255: required base.Base Base
}

struct GetTaskResponse {
  1: required Task task

  255: required base.BaseResp BaseResp
}

// ===== 修改任务 =====

// 局部更新：只改传了的字段。optional 字段有两种含义：
//   字段缺省   → 不修改这一列
//   传空字符串 → 清空这一列（落库为 NULL）
struct UpdateTaskRequest {
  1: required string userId
  2: required string taskId          // 要改的任务
  3: required i32 expectedVersion    // 客户端读到的版本号；与当前 version 不符时不写库，返回冲突
  4: optional string title
  5: optional string notes
  6: optional string status          // 改成 done 时必须走 CompleteTask，不能直接改这个字段
  7: optional string priority
  8: optional string projectId
  9: optional string parentId
  10: optional string scheduledDate
  11: optional string dueDate
  12: optional i32 estimateMinutes
  13: optional list<string> tagIds   // 传了就整体替换，不是增量追加

  255: required base.Base Base
}

struct UpdateTaskResponse {
  1: required Task task              // 写回后的任务，version 已加一

  255: required base.BaseResp BaseResp
}

// ===== 完成任务 =====

struct CompleteTaskRequest {
  1: required string userId
  2: required string taskId
  3: bool cascade = false            // false 只完成任务本身；true 一并完成未完成的子任务

  255: required base.Base Base
}

struct CompleteTaskResponse {
  1: required Task task              // 完成后的任务，status=done，completedAt 已写入

  255: required base.BaseResp BaseResp
}

// ===== 重新打开任务 =====

struct ReopenTaskRequest {
  1: required string userId
  2: required string taskId

  255: required base.Base Base
}

struct ReopenTaskResponse {
  1: required Task task              // 重新打开后的任务，completedAt 已清空

  255: required base.BaseResp BaseResp
}

// ===== 删除任务 =====

struct DeleteTaskRequest {
  1: required string userId
  2: required string taskId
  3: bool confirm = false            // 有子任务时必须为 true 才执行，否则只返回子任务数量

  255: required base.Base Base
}

struct DeleteTaskResponse {
  1: required i32 affectedSubtasks   // 跟着一起软删的子任务数量；前端用来提示"已删除 N 个子任务"

  255: required base.BaseResp BaseResp
}

// ===== 今天视图 =====

struct ListTodayRequest {
  1: required string userId
  2: required string date            // YYYY-MM-DD；服务端不用自己的时区推导"今天"

  255: required base.Base Base
}

struct ListTodayResponse {
  1: required Today today

  255: required base.BaseResp BaseResp
}

// ===== 共用类型 =====

// 读出来的任务。required 字段读出必有值；optional 字段是对应列为 NULL 的情况。
struct Task {
  1: required string id
  2: required string spaceId          // 所属空间
  3: optional string projectId        // 所属项目；为空表示只挂在空间上
  4: optional string parentId         // 父任务；为空表示这是顶层任务
  5: required string title
  6: required string notes            // 没有备注时是空串，不是 NULL
  7: required string status           // inbox|next|doing|waiting|blocked|done；没有 archived
  8: required string priority         // none|low|medium|high|urgent
  9: optional string scheduledDate    // 计划日期，YYYY-MM-DD
  10: optional string dueDate         // 截止日期，YYYY-MM-DD
  11: optional i32 estimateMinutes    // 预估分钟数；没估过则为空
  12: required i32 actualMinutes      // 实际分钟数，非负，默认 0；v2.0 只存不用，由将来的专注功能写入
  13: optional string completedAt     // 完成时间，UTC ISO-8601；与 status 强绑定：done 时必有，非 done 时必为 NULL
  14: required i32 version            // 乐观锁版本，从 1 开始，每次成功写入 +1；客户端不能设置
  15: required string createdAt       // UTC ISO-8601
  16: required string updatedAt       // UTC ISO-8601
  17: optional list<string> tagIds    // 挂着的标签；没有则为空
}

// 今天页的一个分组。
struct TodayGroup {
  1: required string key              // overdue|dueToday|planned|doing|next|completed，前端按 key 原样渲染
  2: required i32 count               // 本组任务数
  3: required i32 estimateMinutes     // 本组预估合计，只累加 estimateMinutes 非空的任务
  4: required list<Task> tasks        // 本组任务，按优先级、截止日期排序
}

// 今天视图。不是任务状态，是按客户端传入的日期算出来的快照。
// 一个任务只进优先级最高的那一组：逾期 → 今天到期 → 今天计划 → 进行中 → 下一步 → 今日完成。
// 第 5 组 key 是 next，同时包含 status 为 next 与 inbox（收件箱）的任务。
struct Today {
  1: required string date             // 客户端传的 YYYY-MM-DD；服务端不用自己的时区推导"今天"
  2: required list<TodayGroup> groups // 固定六组，即使为空也返回，前端不必判空
}

// ===== 服务 =====

service TaskService {
  // 创建任务。同一 userId + idempotencyKey 重复调用返回首次结果，不会建出两条。
  CreateTaskResponse CreateTask(1: CreateTaskRequest req)

  // 按 id 读取。任务不存在或已软删除时返回 NOT_FOUND。
  GetTaskResponse GetTask(1: GetTaskRequest req)

  // 局部更新，靠 expectedVersion 做乐观锁；版本对不上时返回冲突，不写库。
  UpdateTaskResponse UpdateTask(1: UpdateTaskRequest req)

  // 完成任务：status 置 done 并写 completedAt。
  // cascade=false 只动任务本身；true 时一并完成未完成的子任务，已完成的保持不变。
  // 联动在消费者里按子任务逐个开事务，不在父任务的聚合内完成，所以中间态可见。
  CompleteTaskResponse CompleteTask(1: CompleteTaskRequest req)

  // 重新打开：从 done 回到非 done 状态，同时清空 completedAt。
  ReopenTaskResponse ReopenTask(1: ReopenTaskRequest req)

  // 软删除，写 deleted_at，保留 30 天后物理清理。
  // 有子任务且 confirm=false 时不删，返回子任务数量让前端来确认；
  // confirm=true 时父子在同一事务里一起软删，不留孤儿。
  DeleteTaskResponse DeleteTask(1: DeleteTaskRequest req)

  // 今天视图。date 由客户端传入，服务端不推导"今天"；归档项目下的任务不进任何分组。
  ListTodayResponse ListToday(1: ListTodayRequest req)
}
