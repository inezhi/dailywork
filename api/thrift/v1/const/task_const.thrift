// task 领域的枚举。按领域一个文件，新增取值只在文件内追加。
// 枚举值是线协议的一部分：已发布的编号不复用、不改含义。
namespace go taskconst

// 任务状态。没有 archived —— 归档只作用于空间与项目。
enum TaskStatus {
  INBOX   = 1   // 收件箱，新建任务的默认状态
  NEXT    = 2   // 已排期但还没开始
  DOING   = 3   // 正在做
  WAITING = 4   // 等外部条件，不是自己卡住
  BLOCKED = 5   // 被问题卡住
  DONE    = 6   // 已完成；与 completedAt 强绑定
}

// 优先级。只影响排序与视觉，不参与今天分组。
enum TaskPriority {
  NONE   = 1   // 未设置，默认值
  LOW    = 2
  MEDIUM = 3
  HIGH   = 4
  URGENT = 5
}
