// 内部 RPC 的公共结构，identity / task 以及后续服务共用同一份。
// 约定：每个请求在 255 号字段放 Base，每个响应在 255 号字段放 BaseResp。
// 255 是给公共结构预留的编号，业务字段一律从 1 开始，两边不会打架。
// 字段编号在这里固定：以后加字段只能往后追加，不复用、不重排。
namespace go base

// 调用上下文。由 gateway 在转发前填好，业务服务只读不写。
struct Base {
  1: string logId = ""    // 一次请求的追踪号；gateway 生成，贯穿 gateway → 业务服务 → 日志
  2: string caller = ""   // 调用方服务名，如 "gateway"；用于日志定位和调用来源统计
}

// 处理结果。statusCode 非 0 时，同一响应里的业务字段无意义，调用方只读本结构。
struct BaseResp {
  1: string statusMessage = ""  // 面向用户的说明，可直接展示；禁止放 SQL、堆栈或内部地址
  2: i32 statusCode = 0         // 0 = 成功；非 0 为业务错误码，由 gateway 映射成 07 §4 的对外错误码
}
