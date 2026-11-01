// identity 服务的内部契约。管账户、密码、会话与验证码。
// M1 只开放会话校验：gateway 每收到一个请求，都要问 identity 这个会话还有效吗。
// 注册、登录、退出、改密码在切片 2 再补进这里。
include "base.thrift"

namespace go identity

// 校验一次会话。网页端传 Cookie 里的令牌，桌面端传 Bearer 里的令牌，到这里没有区别。
// identity 用令牌的哈希比对 sessions 表，并检查是否过期。
struct ValidateSessionRequest {
  1: required string sessionToken   // 原始令牌，不是哈希；identity 自己算哈希去比对

  255: required base.Base Base
}

// 校验通过时返回的三项。只返回调用方用得上的信息，
// 不返回密码哈希、邮箱、验证码等与鉴权无关的字段。
struct ValidateSessionResponse {
  1: required string userId        // 会话归属的用户
  2: required string username      // 显示用；gateway 写日志、放进响应
  3: required string expiresAt     // 会话过期时间，UTC ISO-8601；gateway 可据此决定 Cookie 的 Max-Age

  255: required base.BaseResp BaseResp
}

service IdentityService {
  // 校验会话。令牌不存在、已过期或已注销时返回未认证，gateway 映射成 401 UNAUTHORIZED。
  // 这是 gateway 鉴权的唯一入口：gateway 不读 identity 的库，也不自己解析会话。
  ValidateSessionResponse ValidateSession(1: ValidateSessionRequest req)
}
