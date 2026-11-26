// 本文件用假 RPC 客户端测试 HTTP 适配器，不依赖真实服务。
package hertz

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/app/server"
	"github.com/cloudwego/hertz/pkg/common/ut"
	"github.com/cloudwego/kitex/client/callopt"

	"github.com/inezhi/dailywork/api/gen/base"
	"github.com/inezhi/dailywork/api/gen/rpc"
	"github.com/inezhi/dailywork/api/gen/taskconst"
	"github.com/inezhi/dailywork/api/gen/taskmodel"
)

// fakeTaskClient 是测试用的 RPC 客户端，按字段返回预设结果。
type fakeTaskClient struct {
	echoResp   *rpc.EchoResp
	echoErr    error
	createResp *rpc.CreateTaskResp
	createErr  error

	// lastCreateReq 记录最近一次创建请求，用来断言 gateway 传了什么
	lastCreateReq *rpc.CreateTaskReq

	sendCodeResp *rpc.SendCodeResp
	sendCodeErr  error
	registerResp *rpc.RegisterResp
	registerErr  error
	loginResp    *rpc.LoginResp
	loginErr     error
	logoutResp   *rpc.LogoutResp
	logoutErr    error
	validateResp *rpc.ValidateSessionResp
	validateErr  error

	lastSendCodeReq *rpc.SendCodeReq
	lastRegisterReq *rpc.RegisterReq
	lastLoginReq    *rpc.LoginReq
	lastLogoutReq   *rpc.LogoutReq

	listTodayResp    *rpc.ListTodayResp
	listTodayErr     error
	lastListTodayReq *rpc.ListTodayReq

	completeResp    *rpc.CompleteTaskResp
	completeErr     error
	lastCompleteReq *rpc.CompleteTaskReq
}

// Echo 返回预设的 Echo 结果。
func (f *fakeTaskClient) Echo(ctx context.Context, req *rpc.EchoReq, _ ...callopt.Option) (*rpc.EchoResp, error) {
	return f.echoResp, f.echoErr
}

// CreateTask 返回预设的创建结果，并记下请求。
func (f *fakeTaskClient) CreateTask(ctx context.Context, req *rpc.CreateTaskReq, _ ...callopt.Option) (*rpc.CreateTaskResp, error) {
	f.lastCreateReq = req
	return f.createResp, f.createErr
}

// SendCode 返回预设结果，并记下请求。
func (f *fakeTaskClient) SendCode(ctx context.Context, req *rpc.SendCodeReq, _ ...callopt.Option) (*rpc.SendCodeResp, error) {
	f.lastSendCodeReq = req
	if f.sendCodeErr != nil {
		return nil, f.sendCodeErr
	}
	if f.sendCodeResp == nil {
		return &rpc.SendCodeResp{BaseResp: &base.BaseResp{}}, nil
	}
	return f.sendCodeResp, nil
}

// Register 返回预设结果，并记下请求。
func (f *fakeTaskClient) Register(ctx context.Context, req *rpc.RegisterReq, _ ...callopt.Option) (*rpc.RegisterResp, error) {
	f.lastRegisterReq = req
	if f.registerErr != nil {
		return nil, f.registerErr
	}
	if f.registerResp == nil {
		return &rpc.RegisterResp{BaseResp: &base.BaseResp{}}, nil
	}
	return f.registerResp, nil
}

// Login 返回预设结果，并记下请求。
func (f *fakeTaskClient) Login(ctx context.Context, req *rpc.LoginReq, _ ...callopt.Option) (*rpc.LoginResp, error) {
	f.lastLoginReq = req
	if f.loginErr != nil {
		return nil, f.loginErr
	}
	if f.loginResp == nil {
		return &rpc.LoginResp{BaseResp: &base.BaseResp{}}, nil
	}
	return f.loginResp, nil
}

// Logout 返回预设结果，并记下请求。
func (f *fakeTaskClient) Logout(ctx context.Context, req *rpc.LogoutReq, _ ...callopt.Option) (*rpc.LogoutResp, error) {
	f.lastLogoutReq = req
	if f.logoutErr != nil {
		return nil, f.logoutErr
	}
	if f.logoutResp == nil {
		return &rpc.LogoutResp{BaseResp: &base.BaseResp{}}, nil
	}
	return f.logoutResp, nil
}

// ValidateSession 返回预设结果。
func (f *fakeTaskClient) ValidateSession(ctx context.Context, req *rpc.ValidateSessionReq, _ ...callopt.Option) (*rpc.ValidateSessionResp, error) {
	if f.validateErr != nil {
		return nil, f.validateErr
	}
	if f.validateResp == nil {
		return &rpc.ValidateSessionResp{BaseResp: &base.BaseResp{}}, nil
	}
	return f.validateResp, nil
}

// ListToday 返回预设结果，并记下请求。
func (f *fakeTaskClient) ListToday(ctx context.Context, req *rpc.ListTodayReq, _ ...callopt.Option) (*rpc.ListTodayResp, error) {
	f.lastListTodayReq = req
	if f.listTodayErr != nil {
		return nil, f.listTodayErr
	}
	if f.listTodayResp == nil {
		return &rpc.ListTodayResp{BaseResp: &base.BaseResp{}}, nil
	}
	return f.listTodayResp, nil
}

// CompleteTask 返回预设结果，并记下请求。
func (f *fakeTaskClient) CompleteTask(ctx context.Context, req *rpc.CompleteTaskReq, _ ...callopt.Option) (*rpc.CompleteTaskResp, error) {
	f.lastCompleteReq = req
	if f.completeErr != nil {
		return nil, f.completeErr
	}
	if f.completeResp == nil {
		return &rpc.CompleteTaskResp{BaseResp: &base.BaseResp{}}, nil
	}
	return f.completeResp, nil
}

// 测试用中间件：补上 requestId 与 userId
func testContext(requestID string, userID string) app.HandlerFunc {
	return func(ctx context.Context, c *app.RequestContext) {
		c.Set(contextRequestID, requestID)
		c.Set(contextUserID, userID)
		c.Set(contextSessionID, "sess-test")
		c.Next(ctx)
	}
}

// performJSON 在内存里发一次 JSON 请求，返回状态码和响应体。
func performJSON(t *testing.T, engine *server.Hertz, path string, body string) (int, string) {
	t.Helper()
	recorder := ut.PerformRequest(
		engine.Engine,
		"POST",
		path,
		&ut.Body{Body: bytes.NewBufferString(body), Len: len(body)},
		ut.Header{Key: "Content-Type", Value: "application/json"},
	)
	return recorder.Code, recorder.Body.String()
}

func TestEchoSuccess(t *testing.T) {
	fake := &fakeTaskClient{
		echoResp: &rpc.EchoResp{
			Message:  "hi",
			BaseResp: &base.BaseResp{StatusCode: 0},
		},
	}
	engine := server.New()
	engine.POST("/api/v1/echo", testContext("req-test", "u-test"), NewEcho(fake).Handle)

	status, body := performJSON(t, engine, "/api/v1/echo", `{"message":"hi"}`)
	if status != 200 {
		t.Fatalf("status = %d, want 200", status)
	}
	if !strings.Contains(body, `"message":"hi"`) {
		t.Errorf("body = %s", body)
	}
}

func TestEchoEmptyMessage(t *testing.T) {
	engine := server.New()
	engine.POST("/api/v1/echo", testContext("req-test", "u-test"), NewEcho(&fakeTaskClient{}).Handle)

	status, body := performJSON(t, engine, "/api/v1/echo", `{"message":""}`)
	if status != 400 {
		t.Fatalf("status = %d, want 400", status)
	}
	if !strings.Contains(body, "VALIDATION_FAILED") {
		t.Errorf("body = %s", body)
	}
}

func TestEchoRPCErrorMapped(t *testing.T) {
	fake := &fakeTaskClient{
		echoResp: &rpc.EchoResp{
			BaseResp: &base.BaseResp{StatusCode: 400, StatusMessage: "不合法"},
		},
	}
	engine := server.New()
	engine.POST("/api/v1/echo", testContext("req-test", "u-test"), NewEcho(fake).Handle)

	status, body := performJSON(t, engine, "/api/v1/echo", `{"message":"hi"}`)
	if status != 400 {
		t.Fatalf("status = %d, want 400", status)
	}
	if !strings.Contains(body, `"code":"VALIDATION_FAILED"`) {
		t.Errorf("body = %s", body)
	}
}

func TestEchoTransportError(t *testing.T) {
	fake := &fakeTaskClient{echoErr: errors.New("connection refused")}
	engine := server.New()
	engine.POST("/api/v1/echo", testContext("req-test", "u-test"), NewEcho(fake).Handle)

	status, body := performJSON(t, engine, "/api/v1/echo", `{"message":"hi"}`)
	if status != 500 {
		t.Fatalf("status = %d, want 500", status)
	}
	if !strings.Contains(body, `"code":"INTERNAL"`) {
		t.Errorf("body = %s", body)
	}
}

func TestCreateTaskSuccess(t *testing.T) {
	fake := &fakeTaskClient{
		createResp: &rpc.CreateTaskResp{
			Task: &taskmodel.Task{
				Id:            "11111111-1111-1111-1111-111111111111",
				SpaceId:       "22222222-2222-2222-2222-222222222222",
				Title:         "测试任务",
				Status:        taskconst.TaskStatus_INBOX,
				Priority:      taskconst.TaskPriority_NONE,
				ActualMinutes: 0,
				Version:       1,
				CreatedAt:     "2026-11-23T10:00:00Z",
				UpdatedAt:     "2026-11-23T10:00:00Z",
			},
			BaseResp: &base.BaseResp{StatusCode: 0},
		},
	}
	engine := server.New()
	engine.POST("/api/v1/tasks", testContext("req-test", "u-test"), NewCreateTask(fake).Handle)

	status, body := performJSON(t, engine, "/api/v1/tasks",
		`{"title":"测试任务","spaceId":"22222222-2222-2222-2222-222222222222"}`)
	if status != 200 {
		t.Fatalf("status = %d, want 200: %s", status, body)
	}
	if !strings.Contains(body, `"version":1`) || !strings.Contains(body, `"status":"inbox"`) {
		t.Errorf("body = %s", body)
	}
	// 用户 id 来自构造函数，不是请求体
	if fake.lastCreateReq == nil || fake.lastCreateReq.UserId != "u-test" {
		t.Errorf("userId = %v, want u-test", fake.lastCreateReq)
	}
}

func TestCreateTaskMissingTitle(t *testing.T) {
	engine := server.New()
	engine.POST("/api/v1/tasks", testContext("req-test", "u-test"), NewCreateTask(&fakeTaskClient{}).Handle)

	status, body := performJSON(t, engine, "/api/v1/tasks",
		`{"spaceId":"22222222-2222-2222-2222-222222222222"}`)
	if status != 400 {
		t.Fatalf("status = %d, want 400", status)
	}
	if !strings.Contains(body, "title 长度") {
		t.Errorf("body = %s", body)
	}
}

func TestCreateTaskDoneStatus(t *testing.T) {
	engine := server.New()
	engine.POST("/api/v1/tasks", testContext("req-test", "u-test"), NewCreateTask(&fakeTaskClient{}).Handle)

	status, body := performJSON(t, engine, "/api/v1/tasks",
		`{"title":"x","spaceId":"22222222-2222-2222-2222-222222222222","status":"done"}`)
	if status != 400 {
		t.Fatalf("status = %d, want 400", status)
	}
	if !strings.Contains(body, "status 只能") {
		t.Errorf("body = %s", body)
	}
}

func TestCreateTaskNotFoundMapped(t *testing.T) {
	fake := &fakeTaskClient{
		createResp: &rpc.CreateTaskResp{
			BaseResp: &base.BaseResp{StatusCode: 404, StatusMessage: "任务不存在"},
		},
	}
	engine := server.New()
	engine.POST("/api/v1/tasks", testContext("req-test", "u-test"), NewCreateTask(fake).Handle)

	status, body := performJSON(t, engine, "/api/v1/tasks",
		`{"title":"x","spaceId":"22222222-2222-2222-2222-222222222222"}`)
	if status != 404 {
		t.Fatalf("status = %d, want 404", status)
	}
	if !strings.Contains(body, `"code":"NOT_FOUND"`) {
		t.Errorf("body = %s", body)
	}
}
