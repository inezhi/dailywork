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

// 今天页的分组。编号即展示优先级：一个任务只进最高优先级的那一组。
enum TodayGroupKind {
  OVERDUE         = 1   // 截止日期早于今天且未完成
  DUE_TODAY       = 2   // 截止日期就是今天且未完成
  PLANNED_TODAY   = 3   // 计划日期是今天且未完成
  DOING           = 4   // 状态进行中，前面三组都没捞到
  NEXT            = 5   // 状态 next 或 inbox，前面四组都没捞到
  COMPLETED_TODAY = 6   // 今天完成的
}
