// 完成任务 HTTP 适配器测试
package hertz

import (
	"strings"
	"testing"

	"github.com/cloudwego/hertz/pkg/app/server"

	"github.com/inezhi/dailywork/api/gen/base"
	"github.com/inezhi/dailywork/api/gen/rpc"
	"github.com/inezhi/dailywork/api/gen/taskconst"
	"github.com/inezhi/dailywork/api/gen/taskmodel"
)

func completedTask() *taskmodel.Task {
	completedAt := "2026-11-26T10:00:00Z"
	return &taskmodel.Task{
		Id:          "11111111-1111-1111-1111-111111111111",
		SpaceId:     "22222222-2222-2222-2222-222222222222",
		Title:       "完成的任务",
		Status:      taskconst.TaskStatus_DONE,
		Priority:    taskconst.TaskPriority_NONE,
		Version:     2,
		CompletedAt: &completedAt,
		CreatedAt:   "2026-11-26T09:00:00Z",
		UpdatedAt:   "2026-11-26T10:00:00Z",
	}
}

func TestCompleteTaskHTTP(t *testing.T) {
	fake := &fakeTaskClient{
		completeResp: &rpc.CompleteTaskResp{Task: completedTask(), BaseResp: &base.BaseResp{}},
	}
	engine := server.New()
	engine.POST("/api/v1/tasks/:id/complete", testContext("req-test", "u-test"), NewCompleteTask(fake).Handle)

	status, body := performJSON(t, engine, "/api/v1/tasks/11111111-1111-1111-1111-111111111111/complete", `{"expectedVersion":1}`)
	if status != 200 {
		t.Fatalf("status = %d: %s", status, body)
	}
	if !strings.Contains(body, `"status":"done"`) {
		t.Errorf("body = %s", body)
	}
	if fake.lastCompleteReq == nil {
		t.Fatal("没有转发请求")
	}
	if fake.lastCompleteReq.TaskId != "11111111-1111-1111-1111-111111111111" {
		t.Errorf("taskId = %q", fake.lastCompleteReq.TaskId)
	}
	if fake.lastCompleteReq.UserId != "u-test" {
		t.Errorf("userId = %q", fake.lastCompleteReq.UserId)
	}
	if fake.lastCompleteReq.ExpectedVersion != 1 {
		t.Errorf("expectedVersion = %d", fake.lastCompleteReq.ExpectedVersion)
	}
}

func TestCompleteTaskConflict(t *testing.T) {
	fake := &fakeTaskClient{
		completeResp: &rpc.CompleteTaskResp{
			BaseResp: &base.BaseResp{StatusCode: 409, StatusMessage: "任务已被修改"},
		},
	}
	engine := server.New()
	engine.POST("/api/v1/tasks/:id/complete", testContext("req-test", "u-test"), NewCompleteTask(fake).Handle)

	status, body := performJSON(t, engine, "/api/v1/tasks/11111111-1111-1111-1111-111111111111/complete", `{"expectedVersion":1}`)
	if status != 409 {
		t.Fatalf("status = %d: %s", status, body)
	}
	if !strings.Contains(body, `"code":"VERSION_CONFLICT"`) {
		t.Errorf("body = %s", body)
	}
}

func TestCompleteTaskInvalidVersion(t *testing.T) {
	fake := &fakeTaskClient{}
	engine := server.New()
	engine.POST("/api/v1/tasks/:id/complete", testContext("req-test", "u-test"), NewCompleteTask(fake).Handle)

	status, body := performJSON(t, engine, "/api/v1/tasks/11111111-1111-1111-1111-111111111111/complete", `{"expectedVersion":0}`)
	if status != 400 {
		t.Fatalf("status = %d: %s", status, body)
	}
	if fake.lastCompleteReq != nil {
		t.Error("校验失败时不应该调用 RPC")
	}
}
