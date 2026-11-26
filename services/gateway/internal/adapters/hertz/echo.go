// Package hertz 是 gateway 的入站适配器：把 HTTP 请求翻译成 RPC 调用。
package hertz

import (
	"context"
	"encoding/json"
	"log/slog"
	"unicode/utf8"

	"github.com/cloudwego/hertz/pkg/app"

	"github.com/inezhi/dailywork/api/gen/base"
	api "github.com/inezhi/dailywork/api/gen/http/v1"
	"github.com/inezhi/dailywork/api/gen/rpc"
	"github.com/inezhi/dailywork/api/gen/rpc/dailyworkservice"
)

// 处理POST /api/v1/echo
type Echo struct {
	taskClient dailyworkservice.Client
}

func NewEcho(taskClient dailyworkservice.Client) *Echo {
	return &Echo{taskClient: taskClient}
}

// Echo的处理过程 每次有请求打到这个路径，Hertz 就会调用一次 Handle
func (h *Echo) Handle(ctx context.Context, c *app.RequestContext) {
	// requestId 由中间件生成并放进上下文
	requestID := requestIDFrom(c)

	// 读取请求体、反序列化为 EchoReq，并校验 message 长度
	req, ok := parseEchoRequest(c, requestID) // 传入ID，用于错误时打印
	if !ok {
		return
	}

	// 调用rpc
	resp, ok := h.callEcho(c, ctx, req, requestID)
	if !ok {
		return
	}

	writeEchoResponse(c, resp, requestID)
}

// 解析请求体并做契约级校验。
func parseEchoRequest(c *app.RequestContext, requestID string) (api.EchoReq, bool) {
	// Hertz 的 c.Body() 返回 (请求体字节, 错误)
	body, err := c.Body()
	if err != nil {
		writeError(c, 400, api.VALIDATIONFAILED, "读取请求体失败", requestID)
		return api.EchoReq{}, false
	}

	var req api.EchoReq
	err = json.Unmarshal(body, &req)
	if err != nil {
		writeError(c, 400, api.VALIDATIONFAILED, "请求体不是合法 JSON", requestID)
		return api.EchoReq{}, false
	}

	// 契约规定 1–200 个字符，按字符数算，一个中文不算三个
	length := utf8.RuneCountInString(req.Message)
	if length == 0 || length > 200 {
		writeError(c, 400, api.VALIDATIONFAILED, "message 长度必须在 1 到 200 之间", requestID)
		return api.EchoReq{}, false
	}

	return req, true
}

// 调RPC；失败时直接写 500。
func (h *Echo) callEcho(c *app.RequestContext, ctx context.Context, req api.EchoReq, requestID string) (*rpc.EchoResp, bool) {
	resp, err := h.taskClient.Echo(ctx, &rpc.EchoReq{
		Message: req.Message,
		// Base 是每次 RPC 都要带的上下文，logId 用 requestId 方便串联日志
		Base: &base.Base{LogId: requestID, Caller: "gateway"},
	})
	if err != nil {
		slog.Error("call task echo", "err", err, "requestId", requestID)
		writeError(c, 500, api.INTERNAL, "调用 task 服务失败", requestID)
		return nil, false
	}

	// 非 0 是服务端返回的业务错误，按 statusCode 映射
	if resp.BaseResp.StatusCode != 0 {
		slog.Error("task echo failed",
			"status", resp.BaseResp.StatusCode,
			"message", resp.BaseResp.StatusMessage,
			"requestId", requestID,
		)
		writeRPCError(c, resp.BaseResp.StatusCode, resp.BaseResp.StatusMessage, requestID)
		return nil, false
	}

	return resp, true
}

// 把结果包成 {data, meta}。
func writeEchoResponse(c *app.RequestContext, resp *rpc.EchoResp, requestID string) {
	c.JSON(200, api.EchoEnvelope{
		Data: api.Echo{Message: resp.Message},
		Meta: api.Meta{RequestId: requestID},
	})
}
