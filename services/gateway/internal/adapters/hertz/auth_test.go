// 认证路由与中间件测试
package hertz

import (
	"bytes"
	"context"
	"strings"
	"testing"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/app/server"
	"github.com/cloudwego/hertz/pkg/common/ut"
	"github.com/cloudwego/hertz/pkg/protocol"

	"github.com/inezhi/dailywork/api/gen/base"
	"github.com/inezhi/dailywork/api/gen/rpc"
)

// 发一次带自定义头的 JSON 请求
func performJSONWithHeaders(
	t *testing.T,
	engine *server.Hertz,
	path string,
	body string,
	headers ...ut.Header,
) (int, string, *protocol.ResponseHeader) {
	t.Helper()
	all := append([]ut.Header{{Key: "Content-Type", Value: "application/json"}}, headers...)
	recorder := ut.PerformRequest(
		engine.Engine,
		"POST",
		path,
		&ut.Body{Body: bytes.NewBufferString(body), Len: len(body)},
		all...,
	)
	return recorder.Code, recorder.Body.String(), recorder.Header()
}

func TestSendCodeHTTP(t *testing.T) {
	fake := &fakeTaskClient{
		sendCodeResp: &rpc.SendCodeResp{Channel: "email", BaseResp: &base.BaseResp{}},
	}
	engine := server.New()
	engine.POST("/api/v1/auth/codes", RequestIDMiddleware, NewSendCode(fake).Handle)

	status, body, _ := performJSONWithHeaders(t, engine, "/api/v1/auth/codes", `{"email":"a@b.com"}`)
	if status != 200 {
		t.Fatalf("status = %d: %s", status, body)
	}
	if !strings.Contains(body, `"channel":"email"`) {
		t.Errorf("body = %s", body)
	}
	if fake.lastSendCodeReq == nil || fake.lastSendCodeReq.Email == nil {
		t.Fatal("没有转发请求")
	}
	if *fake.lastSendCodeReq.Email != "a@b.com" {
		t.Errorf("email = %q", *fake.lastSendCodeReq.Email)
	}
}

func TestRegisterHTTP(t *testing.T) {
	fake := &fakeTaskClient{
		registerResp: &rpc.RegisterResp{
			UserId:   "11111111-1111-1111-1111-111111111111",
			BaseResp: &base.BaseResp{},
		},
	}
	engine := server.New()
	engine.POST("/api/v1/auth/register", RequestIDMiddleware, NewRegister(fake).Handle)

	status, body, _ := performJSONWithHeaders(t, engine, "/api/v1/auth/register",
		`{"email":"a@b.com","code":"2222","password":"password123"}`)
	if status != 200 {
		t.Fatalf("status = %d: %s", status, body)
	}
	if !strings.Contains(body, `"userId":"11111111-1111-1111-1111-111111111111"`) {
		t.Errorf("body = %s", body)
	}
}

func TestRegisterConflict(t *testing.T) {
	fake := &fakeTaskClient{
		registerResp: &rpc.RegisterResp{
			BaseResp: &base.BaseResp{StatusCode: 409, StatusMessage: "已注册"},
		},
	}
	engine := server.New()
	engine.POST("/api/v1/auth/register", RequestIDMiddleware, NewRegister(fake).Handle)

	status, body, _ := performJSONWithHeaders(t, engine, "/api/v1/auth/register",
		`{"email":"a@b.com","code":"2222","password":"password123"}`)
	if status != 409 {
		t.Fatalf("status = %d: %s", status, body)
	}
	if !strings.Contains(body, `"code":"VERSION_CONFLICT"`) {
		t.Errorf("body = %s", body)
	}
}

func loginFake() *fakeTaskClient {
	return &fakeTaskClient{
		loginResp: &rpc.LoginResp{
			Token:     "token-1",
			UserId:    "11111111-1111-1111-1111-111111111111",
			ExpiresAt: "2026-12-26T15:00:00Z",
			BaseResp:  &base.BaseResp{},
		},
	}
}

func TestLoginWebSetsCookie(t *testing.T) {
	engine := server.New()
	engine.POST("/api/v1/auth/login", RequestIDMiddleware, NewLogin(loginFake()).Handle)

	status, body, header := performJSONWithHeaders(t, engine, "/api/v1/auth/login",
		`{"email":"a@b.com","password":"password123"}`)
	if status != 200 {
		t.Fatalf("status = %d: %s", status, body)
	}
	if strings.Contains(body, `"token"`) {
		t.Error("网页端响应体不应该包含 token")
	}
	cookie := string(header.Peek("Set-Cookie"))
	if !strings.Contains(cookie, "daily_session=token-1") {
		t.Errorf("Set-Cookie = %q", cookie)
	}
}

func TestLoginDesktopReturnsToken(t *testing.T) {
	engine := server.New()
	engine.POST("/api/v1/auth/login", RequestIDMiddleware, NewLogin(loginFake()).Handle)

	status, body, header := performJSONWithHeaders(t, engine, "/api/v1/auth/login",
		`{"email":"a@b.com","password":"password123"}`,
		ut.Header{Key: "X-Client", Value: "desktop"})
	if status != 200 {
		t.Fatalf("status = %d: %s", status, body)
	}
	if !strings.Contains(body, `"token":"token-1"`) {
		t.Errorf("body = %s", body)
	}
	if len(header.Peek("Set-Cookie")) != 0 {
		t.Error("桌面端不应该设置 Cookie")
	}
}

func TestLogoutHTTP(t *testing.T) {
	fake := &fakeTaskClient{logoutResp: &rpc.LogoutResp{BaseResp: &base.BaseResp{}}}
	engine := server.New()
	engine.POST("/api/v1/auth/logout", testContext("req-test", "u-test"), NewLogout(fake).Handle)

	status, body, header := performJSONWithHeaders(t, engine, "/api/v1/auth/logout", `{}`)
	if status != 200 {
		t.Fatalf("status = %d: %s", status, body)
	}
	if fake.lastLogoutReq == nil || fake.lastLogoutReq.SessionId != "sess-test" {
		t.Error("没有传递 sessionId")
	}
	cookie := string(header.Peek("Set-Cookie"))
	if !strings.Contains(cookie, "daily_session=") || !strings.Contains(cookie, "max-age=0") {
		t.Errorf("Set-Cookie = %q", cookie)
	}
}

func TestAuthMiddlewareMissingToken(t *testing.T) {
	engine := server.New()
	engine.POST("/protected", RequestIDMiddleware, NewAuthMiddleware(&fakeTaskClient{}), func(ctx context.Context, c *app.RequestContext) {
		c.JSON(200, map[string]string{"ok": "true"})
	})

	status, body, _ := performJSONWithHeaders(t, engine, "/protected", `{}`)
	if status != 401 {
		t.Fatalf("status = %d: %s", status, body)
	}
	if !strings.Contains(body, `"code":"UNAUTHORIZED"`) {
		t.Errorf("body = %s", body)
	}
}

func TestAuthMiddlewareValidToken(t *testing.T) {
	fake := &fakeTaskClient{
		validateResp: &rpc.ValidateSessionResp{
			UserId:    "user-1",
			SessionId: "sess-1",
			BaseResp:  &base.BaseResp{},
		},
	}
	engine := server.New()
	engine.POST("/protected", RequestIDMiddleware, NewAuthMiddleware(fake), func(ctx context.Context, c *app.RequestContext) {
		c.JSON(200, map[string]string{"userId": c.GetString(contextUserID)})
	})

	status, body, _ := performJSONWithHeaders(t, engine, "/protected", `{}`,
		ut.Header{Key: "Authorization", Value: "Bearer token-1"})
	if status != 200 {
		t.Fatalf("status = %d: %s", status, body)
	}
	if !strings.Contains(body, `"userId":"user-1"`) {
		t.Errorf("body = %s", body)
	}
}

func TestAuthMiddlewareInvalidToken(t *testing.T) {
	fake := &fakeTaskClient{
		validateResp: &rpc.ValidateSessionResp{
			BaseResp: &base.BaseResp{StatusCode: 401, StatusMessage: "登录已失效"},
		},
	}
	engine := server.New()
	engine.POST("/protected", RequestIDMiddleware, NewAuthMiddleware(fake), func(ctx context.Context, c *app.RequestContext) {
		c.JSON(200, map[string]string{"ok": "true"})
	})

	status, body, _ := performJSONWithHeaders(t, engine, "/protected", `{}`,
		ut.Header{Key: "Authorization", Value: "Bearer bad"})
	if status != 401 {
		t.Fatalf("status = %d: %s", status, body)
	}
}
