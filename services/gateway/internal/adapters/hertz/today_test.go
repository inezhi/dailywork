// 今天页 HTTP 适配器测试
package hertz

import (
	"strings"
	"testing"

	"github.com/cloudwego/hertz/pkg/app/server"
	"github.com/cloudwego/hertz/pkg/common/ut"

	"github.com/inezhi/dailywork/api/gen/base"
	"github.com/inezhi/dailywork/api/gen/rpc"
	"github.com/inezhi/dailywork/api/gen/taskconst"
	"github.com/inezhi/dailywork/api/gen/taskmodel"
)

// 发一次 GET 请求
func performGET(t *testing.T, engine *server.Hertz, path string) (int, string) {
	t.Helper()
	recorder := ut.PerformRequest(engine.Engine, "GET", path, nil)
	return recorder.Code, recorder.Body.String()
}

func TestTodayHTTP(t *testing.T) {
	fake := &fakeTaskClient{
		listTodayResp: &rpc.ListTodayResp{
			Groups: []*rpc.TodayGroup{
				{
					Kind: taskconst.TodayGroupKind_OVERDUE,
					Tasks: []*taskmodel.Task{
						{
							Id:        "11111111-1111-1111-1111-111111111111",
							SpaceId:   "22222222-2222-2222-2222-222222222222",
							Title:     "过期任务",
							Status:    taskconst.TaskStatus_DOING,
							Priority:  taskconst.TaskPriority_NONE,
							Version:   1,
							CreatedAt: "2026-11-26T10:00:00Z",
							UpdatedAt: "2026-11-26T10:00:00Z",
						},
					},
					Count:           1,
					EstimateMinutes: 30,
				},
			},
			BaseResp: &base.BaseResp{},
		},
	}

	engine := server.New()
	engine.GET("/api/v1/today", testContext("req-test", "u-test"), NewToday(fake).Handle)

	status, body := performGET(t, engine, "/api/v1/today?date=2026-11-26&tz=Asia%2FShanghai")
	if status != 200 {
		t.Fatalf("status = %d: %s", status, body)
	}
	for _, want := range []string{`"kind":"overdue"`, `"count":1`, `"estimateMinutes":30`, `"date":"2026-11-26"`} {
		if !strings.Contains(body, want) {
			t.Errorf("body 缺少 %s: %s", want, body)
		}
	}
	if fake.lastListTodayReq == nil || fake.lastListTodayReq.Date != "2026-11-26" {
		t.Error("没有传递 date")
	}
	if fake.lastListTodayReq.UserId != "u-test" {
		t.Errorf("userId = %q", fake.lastListTodayReq.UserId)
	}
	if fake.lastListTodayReq.Timezone == nil || *fake.lastListTodayReq.Timezone != "Asia/Shanghai" {
		t.Errorf("timezone = %v", fake.lastListTodayReq.Timezone)
	}
}

func TestTodayMissingDate(t *testing.T) {
	engine := server.New()
	engine.GET("/api/v1/today", testContext("req-test", "u-test"), NewToday(&fakeTaskClient{}).Handle)

	status, body := performGET(t, engine, "/api/v1/today")
	if status != 400 {
		t.Fatalf("status = %d: %s", status, body)
	}
}

func TestTodayInvalidDate(t *testing.T) {
	engine := server.New()
	engine.GET("/api/v1/today", testContext("req-test", "u-test"), NewToday(&fakeTaskClient{}).Handle)

	status, body := performGET(t, engine, "/api/v1/today?date=11-26")
	if status != 400 {
		t.Fatalf("status = %d: %s", status, body)
	}
}
