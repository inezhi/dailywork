// 本文件测试 HTTP 与 Thrift 之间的类型转换。
package hertz

import (
	"testing"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"

	api "github.com/inezhi/dailywork/api/gen/http/v1"
	"github.com/inezhi/dailywork/api/gen/taskconst"
	"github.com/inezhi/dailywork/api/gen/taskmodel"
)

func TestToHTTPStatus(t *testing.T) {
	cases := []struct {
		name  string
		input taskconst.TaskStatus
		want  api.TaskStatus
	}{
		{"inbox", taskconst.TaskStatus_INBOX, api.TaskStatusInbox},
		{"next", taskconst.TaskStatus_NEXT, api.TaskStatusNext},
		{"doing", taskconst.TaskStatus_DOING, api.TaskStatusDoing},
		{"waiting", taskconst.TaskStatus_WAITING, api.TaskStatusWaiting},
		{"blocked", taskconst.TaskStatus_BLOCKED, api.TaskStatusBlocked},
		{"done", taskconst.TaskStatus_DONE, api.TaskStatusDone},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := toHTTPStatus(tc.input)
			if err != nil {
				t.Fatalf("err = %v", err)
			}
			if got != tc.want {
				t.Errorf("got = %q, want %q", got, tc.want)
			}
		})
	}

	if _, err := toHTTPStatus(taskconst.TaskStatus(99)); err == nil {
		t.Error("未知状态应该报错")
	}
}

func TestToHTTPPriority(t *testing.T) {
	cases := []struct {
		name  string
		input taskconst.TaskPriority
		want  api.TaskPriority
	}{
		{"none", taskconst.TaskPriority_NONE, api.None},
		{"low", taskconst.TaskPriority_LOW, api.Low},
		{"medium", taskconst.TaskPriority_MEDIUM, api.Medium},
		{"high", taskconst.TaskPriority_HIGH, api.High},
		{"urgent", taskconst.TaskPriority_URGENT, api.Urgent},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := toHTTPPriority(tc.input)
			if err != nil {
				t.Fatalf("err = %v", err)
			}
			if got != tc.want {
				t.Errorf("got = %q, want %q", got, tc.want)
			}
		})
	}

	if _, err := toHTTPPriority(taskconst.TaskPriority(99)); err == nil {
		t.Error("未知优先级应该报错")
	}
}

func TestToThriftStatus(t *testing.T) {
	cases := []struct {
		input api.CreateTaskStatus
		want  taskconst.TaskStatus
	}{
		{api.CreateTaskStatusInbox, taskconst.TaskStatus_INBOX},
		{api.CreateTaskStatusNext, taskconst.TaskStatus_NEXT},
		{api.CreateTaskStatusDoing, taskconst.TaskStatus_DOING},
		{api.CreateTaskStatusWaiting, taskconst.TaskStatus_WAITING},
		{api.CreateTaskStatusBlocked, taskconst.TaskStatus_BLOCKED},
	}

	for _, tc := range cases {
		if got := toThriftStatus(tc.input); got != tc.want {
			t.Errorf("%q: got = %d, want %d", tc.input, got, tc.want)
		}
	}
}

func TestToThriftPriority(t *testing.T) {
	cases := []struct {
		input api.TaskPriority
		want  taskconst.TaskPriority
	}{
		{api.None, taskconst.TaskPriority_NONE},
		{api.Low, taskconst.TaskPriority_LOW},
		{api.Medium, taskconst.TaskPriority_MEDIUM},
		{api.High, taskconst.TaskPriority_HIGH},
		{api.Urgent, taskconst.TaskPriority_URGENT},
	}

	for _, tc := range cases {
		if got := toThriftPriority(tc.input); got != tc.want {
			t.Errorf("%q: got = %d, want %d", tc.input, got, tc.want)
		}
	}
}

func TestParseAndFormatDate(t *testing.T) {
	parsed, err := parseDate("2026-11-24")
	if err != nil {
		t.Fatalf("parseDate: %v", err)
	}
	if parsed.Format(openapi_types.DateFormat) != "2026-11-24" {
		t.Errorf("format = %q", parsed.Format(openapi_types.DateFormat))
	}

	formatted := formatDate(parsed)
	if formatted == nil || *formatted != "2026-11-24" {
		t.Errorf("formatted = %v", formatted)
	}

	if formatDate(nil) != nil {
		t.Error("nil 日期应该返回 nil")
	}
}

func TestToHTTPTask(t *testing.T) {
	projectID := "33333333-3333-3333-3333-333333333333"
	scheduledDate := "2026-11-24"
	estimateMinutes := int32(45)

	task := &taskmodel.Task{
		Id:              "11111111-1111-1111-1111-111111111111",
		SpaceId:         "22222222-2222-2222-2222-222222222222",
		ProjectId:       &projectID,
		Title:           "测试任务",
		Notes:           "正文",
		Status:          taskconst.TaskStatus_DOING,
		Priority:        taskconst.TaskPriority_HIGH,
		ScheduledDate:   &scheduledDate,
		EstimateMinutes: &estimateMinutes,
		ActualMinutes:   10,
		Version:         3,
		CreatedAt:       "2026-11-23T10:00:00Z",
		UpdatedAt:       "2026-11-23T11:00:00Z",
	}

	got, err := toHTTPTask(task)
	if err != nil {
		t.Fatalf("toHTTPTask: %v", err)
	}

	if got.Id.String() != task.Id {
		t.Errorf("id = %s", got.Id)
	}
	if got.Status != api.TaskStatusDoing {
		t.Errorf("status = %q", got.Status)
	}
	if got.Priority != api.High {
		t.Errorf("priority = %q", got.Priority)
	}
	if got.ProjectId == nil || got.ProjectId.String() != projectID {
		t.Errorf("projectId = %v", got.ProjectId)
	}
	if got.ScheduledDate == nil || got.ScheduledDate.Format(openapi_types.DateFormat) != scheduledDate {
		t.Errorf("scheduledDate = %v", got.ScheduledDate)
	}
	if got.EstimateMinutes == nil || *got.EstimateMinutes != 45 {
		t.Errorf("estimateMinutes = %v", got.EstimateMinutes)
	}
	if got.Version != 3 || got.ActualMinutes != 10 {
		t.Errorf("version = %d, actualMinutes = %d", got.Version, got.ActualMinutes)
	}
	if got.CreatedAt.Format(time.RFC3339) != "2026-11-23T10:00:00Z" {
		t.Errorf("createdAt = %v", got.CreatedAt)
	}
}

func TestToHTTPTaskWithoutOptionalFields(t *testing.T) {
	task := &taskmodel.Task{
		Id:        "11111111-1111-1111-1111-111111111111",
		SpaceId:   "22222222-2222-2222-2222-222222222222",
		Title:     "最小任务",
		Status:    taskconst.TaskStatus_INBOX,
		Priority:  taskconst.TaskPriority_NONE,
		Version:   1,
		CreatedAt: "2026-11-23T10:00:00Z",
		UpdatedAt: "2026-11-23T10:00:00Z",
	}

	got, err := toHTTPTask(task)
	if err != nil {
		t.Fatalf("toHTTPTask: %v", err)
	}
	if got.ProjectId != nil || got.ParentId != nil || got.ScheduledDate != nil ||
		got.DueDate != nil || got.EstimateMinutes != nil || got.CompletedAt != nil {
		t.Error("可选字段应该保持 nil")
	}
}
