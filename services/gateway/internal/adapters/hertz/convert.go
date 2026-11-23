// 本文件是 HTTP 类型与 Thrift 类型之间的转换。
package hertz

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	api "github.com/inezhi/dailywork/api/gen/http/v1"
	"github.com/inezhi/dailywork/api/gen/taskconst"
	"github.com/inezhi/dailywork/api/gen/taskmodel"
)

// toHTTPTask 把 Thrift 的 Task 转成 OpenAPI 的 Task。
func toHTTPTask(task *taskmodel.Task) (api.Task, error) {
	id, err := uuid.Parse(task.Id)
	if err != nil {
		return api.Task{}, fmt.Errorf("parse task id %q: %w", task.Id, err)
	}

	spaceID, err := uuid.Parse(task.SpaceId)
	if err != nil {
		return api.Task{}, fmt.Errorf("parse space id %q: %w", task.SpaceId, err)
	}

	status, err := toHTTPStatus(task.Status)
	if err != nil {
		return api.Task{}, err
	}

	priority, err := toHTTPPriority(task.Priority)
	if err != nil {
		return api.Task{}, err
	}

	createdAt, err := time.Parse(time.RFC3339, task.CreatedAt)
	if err != nil {
		return api.Task{}, fmt.Errorf("parse createdAt %q: %w", task.CreatedAt, err)
	}

	updatedAt, err := time.Parse(time.RFC3339, task.UpdatedAt)
	if err != nil {
		return api.Task{}, fmt.Errorf("parse updatedAt %q: %w", task.UpdatedAt, err)
	}

	result := api.Task{
		Id:            id,
		SpaceId:       spaceID,
		Title:         task.Title,
		Notes:         task.Notes,
		Status:        status,
		Priority:      priority,
		ActualMinutes: int(task.ActualMinutes),
		Version:       int(task.Version),
		CreatedAt:     createdAt,
		UpdatedAt:     updatedAt,
	}

	// 以下字段在 Thrift 里是可选的，有值才转
	if task.ProjectId != nil {
		projectID, err := uuid.Parse(*task.ProjectId)
		if err != nil {
			return api.Task{}, fmt.Errorf("parse project id %q: %w", *task.ProjectId, err)
		}
		result.ProjectId = &projectID
	}

	if task.ParentId != nil {
		parentID, err := uuid.Parse(*task.ParentId)
		if err != nil {
			return api.Task{}, fmt.Errorf("parse parent id %q: %w", *task.ParentId, err)
		}
		result.ParentId = &parentID
	}

	if task.ScheduledDate != nil {
		date, err := parseDate(*task.ScheduledDate)
		if err != nil {
			return api.Task{}, err
		}
		result.ScheduledDate = date
	}

	if task.DueDate != nil {
		date, err := parseDate(*task.DueDate)
		if err != nil {
			return api.Task{}, err
		}
		result.DueDate = date
	}

	if task.EstimateMinutes != nil {
		minutes := int(*task.EstimateMinutes)
		result.EstimateMinutes = &minutes
	}

	if task.CompletedAt != nil {
		completedAt, err := time.Parse(time.RFC3339, *task.CompletedAt)
		if err != nil {
			return api.Task{}, fmt.Errorf("parse completedAt %q: %w", *task.CompletedAt, err)
		}
		result.CompletedAt = &completedAt
	}

	return result, nil
}

// toHTTPStatus 把 Thrift 的状态编号转成 OpenAPI 的字符串枚举。
func toHTTPStatus(status taskconst.TaskStatus) (api.TaskStatus, error) {
	switch status {
	case taskconst.TaskStatus_INBOX:
		return api.TaskStatusInbox, nil
	case taskconst.TaskStatus_NEXT:
		return api.TaskStatusNext, nil
	case taskconst.TaskStatus_DOING:
		return api.TaskStatusDoing, nil
	case taskconst.TaskStatus_WAITING:
		return api.TaskStatusWaiting, nil
	case taskconst.TaskStatus_BLOCKED:
		return api.TaskStatusBlocked, nil
	case taskconst.TaskStatus_DONE:
		return api.TaskStatusDone, nil
	}
	return "", fmt.Errorf("unknown task status %d", status)
}

// toHTTPPriority 把 Thrift 的优先级编号转成 OpenAPI 的字符串枚举。
func toHTTPPriority(priority taskconst.TaskPriority) (api.TaskPriority, error) {
	switch priority {
	case taskconst.TaskPriority_NONE:
		return api.None, nil
	case taskconst.TaskPriority_LOW:
		return api.Low, nil
	case taskconst.TaskPriority_MEDIUM:
		return api.Medium, nil
	case taskconst.TaskPriority_HIGH:
		return api.High, nil
	case taskconst.TaskPriority_URGENT:
		return api.Urgent, nil
	}
	return "", fmt.Errorf("unknown task priority %d", priority)
}

// toThriftStatus 把 HTTP 的字符串状态转成 Thrift 编号；调用前已校验过取值。
func toThriftStatus(status api.CreateTaskStatus) taskconst.TaskStatus {
	switch status {
	case api.CreateTaskStatusNext:
		return taskconst.TaskStatus_NEXT
	case api.CreateTaskStatusDoing:
		return taskconst.TaskStatus_DOING
	case api.CreateTaskStatusWaiting:
		return taskconst.TaskStatus_WAITING
	case api.CreateTaskStatusBlocked:
		return taskconst.TaskStatus_BLOCKED
	default:
		return taskconst.TaskStatus_INBOX
	}
}

// toThriftPriority 把 HTTP 的字符串优先级转成 Thrift 编号；调用前已校验过取值。
func toThriftPriority(priority api.TaskPriority) taskconst.TaskPriority {
	switch priority {
	case api.Low:
		return taskconst.TaskPriority_LOW
	case api.Medium:
		return taskconst.TaskPriority_MEDIUM
	case api.High:
		return taskconst.TaskPriority_HIGH
	case api.Urgent:
		return taskconst.TaskPriority_URGENT
	default:
		return taskconst.TaskPriority_NONE
	}
}

// parseDate 把 YYYY-MM-DD 字符串转成 OpenAPI 的 Date。
func parseDate(value string) (*openapi_types.Date, error) {
	parsed, err := time.Parse(openapi_types.DateFormat, value)
	if err != nil {
		return nil, fmt.Errorf("parse date %q: %w", value, err)
	}
	return &openapi_types.Date{Time: parsed}, nil
}

// formatDate 把 OpenAPI 的 Date 转成 YYYY-MM-DD；nil 返回 nil。
func formatDate(date *openapi_types.Date) *string {
	if date == nil {
		return nil
	}
	value := date.Format(openapi_types.DateFormat)
	return &value
}
