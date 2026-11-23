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

// ===== 服务 =====

// 只有一个 RPC 服务：gateway 通过它访问全部能力。
service DailyWorkService {
  // 连通性检查。部署后用一次调用确认 gateway ↔ 服务 的链路是通的，不做任何业务。
  EchoResp Echo(1: EchoReq req)

  // 创建任务。同一 userId + idempotencyKey 重复调用返回首次结果，不会建出两条。
  CreateTaskResp CreateTask(1: CreateTaskReq req)

  // 其余方法（GetTask / UpdateTask / CompleteTask / ReopenTask / DeleteTask /
  // ListToday / ValidateSession）在后续切片实现时再加回来；
  // 对应的请求响应结构暂留，避免反复生成。
}
