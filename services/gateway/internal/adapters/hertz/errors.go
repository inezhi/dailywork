// 本文件集中处理错误响应：统一信封和 statusCode 映射。
package hertz

import (
	"github.com/cloudwego/hertz/pkg/app"

	api "github.com/inezhi/dailywork/api/gen/http/v1"
)

// writeError 返回统一错误信封。
func writeError(c *app.RequestContext, status int, code api.ErrorCode, message string, requestID string) {
	c.JSON(status, api.ErrorEnvelope{
		Error: api.ErrorBody{Code: code, Message: message},
		Meta:  api.Meta{RequestId: requestID},
	})
}

// writeRPCError 把 task 服务返回的 statusCode 翻译成 HTTP 状态码和错误码。
func writeRPCError(c *app.RequestContext, statusCode int32, message string, requestID string) {
	status, code := mapStatus(statusCode)
	writeError(c, status, code, message, requestID)
}

// mapStatus 是 statusCode 到 HTTP 状态码与错误码的映射表。
func mapStatus(statusCode int32) (int, api.ErrorCode) {
	switch statusCode {
	case 400:
		return 400, api.VALIDATIONFAILED
	case 401:
		return 401, api.UNAUTHORIZED
	case 404:
		return 404, api.NOTFOUND
	case 409:
		return 409, api.VERSIONCONFLICT
	default:
		// 500 和未知值都按服务端错误处理
		return 500, api.INTERNAL
	}
}
