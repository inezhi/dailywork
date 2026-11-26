// 认证相关的 HTTP 适配器
package hertz

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol"
	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/inezhi/dailywork/api/gen/base"
	api "github.com/inezhi/dailywork/api/gen/http/v1"
	"github.com/inezhi/dailywork/api/gen/rpc"
	"github.com/inezhi/dailywork/api/gen/rpc/dailyworkservice"
)

// SendCode 处理 POST /api/v1/auth/codes
type SendCode struct {
	taskClient dailyworkservice.Client
}

// 注入 RPC 客户端
func NewSendCode(taskClient dailyworkservice.Client) *SendCode {
	return &SendCode{taskClient: taskClient}
}

// 发验证码
func (h *SendCode) Handle(ctx context.Context, c *app.RequestContext) {
	requestID := requestIDFrom(c)

	body, err := c.Body()
	if err != nil {
		writeError(c, 400, api.VALIDATIONFAILED, "读取请求体失败", requestID)
		return
	}

	var req api.SendCodeReq
	err = json.Unmarshal(body, &req)
	if err != nil {
		writeError(c, 400, api.VALIDATIONFAILED, "请求体不是合法 JSON", requestID)
		return
	}

	resp, err := h.taskClient.SendCode(ctx, &rpc.SendCodeReq{
		Email: emailPtr(req.Email),
		Phone: req.Phone,
		Base:  &base.Base{LogId: requestID, Caller: "gateway"},
	})
	if err != nil {
		slog.Error("call task send code", "err", err, "requestId", requestID)
		writeError(c, 500, api.INTERNAL, "调用 task 服务失败", requestID)
		return
	}
	if resp.BaseResp.StatusCode != 0 {
		writeRPCError(c, resp.BaseResp.StatusCode, resp.BaseResp.StatusMessage, requestID)
		return
	}

	c.JSON(200, api.SendCodeEnvelope{
		Data: api.SendCodeData{Channel: api.SendCodeDataChannel(resp.Channel)},
		Meta: api.Meta{RequestId: requestID},
	})
}

// Register 处理 POST /api/v1/auth/register
type Register struct {
	taskClient dailyworkservice.Client
}

// 注入 RPC 客户端
func NewRegister(taskClient dailyworkservice.Client) *Register {
	return &Register{taskClient: taskClient}
}

// 注册账户
func (h *Register) Handle(ctx context.Context, c *app.RequestContext) {
	requestID := requestIDFrom(c)

	body, err := c.Body()
	if err != nil {
		writeError(c, 400, api.VALIDATIONFAILED, "读取请求体失败", requestID)
		return
	}

	var req api.RegisterReq
	err = json.Unmarshal(body, &req)
	if err != nil {
		writeError(c, 400, api.VALIDATIONFAILED, "请求体不是合法 JSON", requestID)
		return
	}

	resp, err := h.taskClient.Register(ctx, &rpc.RegisterReq{
		Email:    emailPtr(req.Email),
		Phone:    req.Phone,
		Code:     req.Code,
		Password: req.Password,
		Base:     &base.Base{LogId: requestID, Caller: "gateway"},
	})
	if err != nil {
		slog.Error("call task register", "err", err, "requestId", requestID)
		writeError(c, 500, api.INTERNAL, "调用 task 服务失败", requestID)
		return
	}
	if resp.BaseResp.StatusCode != 0 {
		writeRPCError(c, resp.BaseResp.StatusCode, resp.BaseResp.StatusMessage, requestID)
		return
	}

	userID, err := uuid.Parse(resp.UserId)
	if err != nil {
		slog.Error("parse user id", "err", err, "requestId", requestID)
		writeError(c, 500, api.INTERNAL, "转换用户数据失败", requestID)
		return
	}

	c.JSON(200, api.RegisterEnvelope{
		Data: api.RegisterData{UserId: userID},
		Meta: api.Meta{RequestId: requestID},
	})
}

// Login 处理 POST /api/v1/auth/login
type Login struct {
	taskClient dailyworkservice.Client
}

// 注入 RPC 客户端
func NewLogin(taskClient dailyworkservice.Client) *Login {
	return &Login{taskClient: taskClient}
}

// 登录；网页端写 Cookie，桌面端返回 token
func (h *Login) Handle(ctx context.Context, c *app.RequestContext) {
	requestID := requestIDFrom(c)

	body, err := c.Body()
	if err != nil {
		writeError(c, 400, api.VALIDATIONFAILED, "读取请求体失败", requestID)
		return
	}

	var req api.LoginReq
	err = json.Unmarshal(body, &req)
	if err != nil {
		writeError(c, 400, api.VALIDATIONFAILED, "请求体不是合法 JSON", requestID)
		return
	}

	desktop := string(c.GetHeader("X-Client")) == "desktop"
	rpcReq := &rpc.LoginReq{
		Email:    emailPtr(req.Email),
		Phone:    req.Phone,
		Password: req.Password,
		Client:   clientPtr(desktop),
		Device:   deviceFrom(c),
		Ip:       ipPtr(c.ClientIP()),
		Base:     &base.Base{LogId: requestID, Caller: "gateway"},
	}

	resp, err := h.taskClient.Login(ctx, rpcReq)
	if err != nil {
		slog.Error("call task login", "err", err, "requestId", requestID)
		writeError(c, 500, api.INTERNAL, "调用 task 服务失败", requestID)
		return
	}
	if resp.BaseResp.StatusCode != 0 {
		writeRPCError(c, resp.BaseResp.StatusCode, resp.BaseResp.StatusMessage, requestID)
		return
	}

	userID, err := uuid.Parse(resp.UserId)
	if err != nil {
		slog.Error("parse user id", "err", err, "requestId", requestID)
		writeError(c, 500, api.INTERNAL, "转换用户数据失败", requestID)
		return
	}
	expiresAt, err := time.Parse(time.RFC3339, resp.ExpiresAt)
	if err != nil {
		slog.Error("parse expires at", "err", err, "requestId", requestID)
		writeError(c, 500, api.INTERNAL, "转换过期时间失败", requestID)
		return
	}

	data := api.LoginData{UserId: userID, ExpiresAt: expiresAt}
	if desktop {
		data.Token = &resp.Token
	} else {
		// 网页端把 token 放进 HttpOnly Cookie，响应体不返回
		maxAge := int(time.Until(expiresAt).Seconds())
		c.SetCookie(sessionCookieName, resp.Token, maxAge, "/", "", protocol.CookieSameSiteLaxMode, false, true)
	}

	c.JSON(200, api.LoginEnvelope{
		Data: data,
		Meta: api.Meta{RequestId: requestID},
	})
}

// Logout 处理 POST /api/v1/auth/logout
type Logout struct {
	taskClient dailyworkservice.Client
}

// 注入 RPC 客户端
func NewLogout(taskClient dailyworkservice.Client) *Logout {
	return &Logout{taskClient: taskClient}
}

// 吊销当前会话并清 Cookie
func (h *Logout) Handle(ctx context.Context, c *app.RequestContext) {
	requestID := requestIDFrom(c)

	resp, err := h.taskClient.Logout(ctx, &rpc.LogoutReq{
		SessionId: sessionIDFrom(c),
		Base:      &base.Base{LogId: requestID, Caller: "gateway"},
	})
	if err != nil {
		slog.Error("call task logout", "err", err, "requestId", requestID)
		writeError(c, 500, api.INTERNAL, "调用 task 服务失败", requestID)
		return
	}
	if resp.BaseResp.StatusCode != 0 {
		writeRPCError(c, resp.BaseResp.StatusCode, resp.BaseResp.StatusMessage, requestID)
		return
	}

	// 让浏览器删掉 Cookie
	c.SetCookie(sessionCookieName, "", -1, "/", "", protocol.CookieSameSiteLaxMode, false, true)

	c.JSON(200, api.OkEnvelope{
		Data: api.OkData{Ok: true},
		Meta: api.Meta{RequestId: requestID},
	})
}

// 把邮箱转成字符串指针
func emailPtr(email *openapi_types.Email) *string {
	if email == nil {
		return nil
	}
	value := string(*email)
	return &value
}

// 根据客户端类型返回 client 字段
func clientPtr(desktop bool) *string {
	value := "web"
	if desktop {
		value = "desktop"
	}
	return &value
}

// 从 User-Agent 取设备描述，最长 100 字符
func deviceFrom(c *app.RequestContext) *string {
	value := string(c.GetHeader("User-Agent"))
	if value == "" {
		return nil
	}
	if len(value) > 100 {
		value = value[:100]
	}
	return &value
}

// 把 IP 转成字符串指针
func ipPtr(ip string) *string {
	if ip == "" {
		return nil
	}
	return &ip
}
