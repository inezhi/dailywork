// 中间件：请求 id 与登录态
package hertz

import (
	"context"
	"strings"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/google/uuid"

	"github.com/inezhi/dailywork/api/gen/base"
	api "github.com/inezhi/dailywork/api/gen/http/v1"
	"github.com/inezhi/dailywork/api/gen/rpc"
	"github.com/inezhi/dailywork/api/gen/rpc/dailyworkservice"
)

// 上下文里的键
const (
	contextRequestID = "requestId"
	contextUserID    = "userId"
	contextSessionID = "sessionId"
)

// 会话 Cookie 名
const sessionCookieName = "daily_session"

// 从上下文取 requestId
func requestIDFrom(c *app.RequestContext) string {
	return c.GetString(contextRequestID)
}

// 从上下文取 userId
func userIDFrom(c *app.RequestContext) string {
	return c.GetString(contextUserID)
}

// 从上下文取 sessionId
func sessionIDFrom(c *app.RequestContext) string {
	return c.GetString(contextSessionID)
}

// 给每个请求生成 requestId
func RequestIDMiddleware(ctx context.Context, c *app.RequestContext) {
	id, err := uuid.NewV7()
	if err != nil {
		c.JSON(500, api.ErrorEnvelope{
			Error: api.ErrorBody{Code: api.INTERNAL, Message: "生成请求 id 失败"},
		})
		c.Abort()
		return
	}

	value := id.String()
	c.Header("X-Request-Id", value)
	c.Set(contextRequestID, value)
	c.Next(ctx)
}

// 校验登录态，把 userId 和 sessionId 放进上下文
func NewAuthMiddleware(taskClient dailyworkservice.Client) app.HandlerFunc {
	return func(ctx context.Context, c *app.RequestContext) {
		token := tokenFromRequest(c)
		if token == "" {
			writeError(c, 401, api.UNAUTHORIZED, "请先登录", requestIDFrom(c))
			c.Abort()
			return
		}

		resp, err := taskClient.ValidateSession(ctx, &rpc.ValidateSessionReq{
			Token: token,
			Base:  &base.Base{LogId: requestIDFrom(c), Caller: "gateway"},
		})
		if err != nil || resp.BaseResp.StatusCode != 0 {
			writeError(c, 401, api.UNAUTHORIZED, "登录已失效", requestIDFrom(c))
			c.Abort()
			return
		}

		c.Set(contextUserID, resp.UserId)
		c.Set(contextSessionID, resp.SessionId)
		c.Next(ctx)
	}
}

// 先看 Authorization，再看 Cookie
func tokenFromRequest(c *app.RequestContext) string {
	header := string(c.GetHeader("Authorization"))
	if strings.HasPrefix(header, "Bearer ") {
		return strings.TrimPrefix(header, "Bearer ")
	}
	return string(c.Cookie(sessionCookieName))
}
