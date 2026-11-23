// task 领域的领域对象。只有实体和视图，请求与响应在 ../dailywork.thrift，不在这个文件里。
// 字段编号即线协议：发布后不复用、不重排，新增字段只能往后追加。
include "../const/task_const.thrift"

namespace go taskmodel

// 读出来的任务。required 字段读出必有值；optional 字段是对应列为 NULL 的情况。
struct Task {
  1: required string id
  2: required string spaceId          // 所属空间
  3: optional string projectId        // 所属项目；为空表示只挂在空间上
  4: optional string parentId         // 父任务；为空表示这是顶层任务
  5: required string title
  6: required string notes            // 没有备注时是空串，不是 NULL
  7: required task_const.TaskStatus status         // 取值见 task_const.TaskStatus；没有 archived
  8: required task_const.TaskPriority priority     // 取值见 task_const.TaskPriority
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
