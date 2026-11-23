// Package kitex 把 RPC 请求翻译成应用层调用；这里只做协议转换，不写业务规则。
package kitex

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/inezhi/dailywork/api/gen/base"
	"github.com/inezhi/dailywork/api/gen/rpc"
	"github.com/inezhi/dailywork/api/gen/taskconst"
	"github.com/inezhi/dailywork/api/gen/taskmodel"
	"github.com/inezhi/dailywork/services/task/internal/application"
	"github.com/inezhi/dailywork/services/task/internal/domain"
)

// 业务状态码：0 成功，其余沿用 HTTP 大类的数字，gateway 直接映射。
const (
	codeOK       int32 = 0
	codeInvalid  int32 = 400
	codeNotFound int32 = 404
	codeConflict int32 = 409
	codeInternal int32 = 500
)

// 类型声明，完成请求接口的任务需要谁就写谁
type Handler struct {
	createTask *application.CreateTask
}

// New 把创建任务的用例装进 Handler。
func New(createTask *application.CreateTask) *Handler {
	return &Handler{createTask: createTask}
}

// Echo 原样返回，用于检查链路。
func (h *Handler) Echo(ctx context.Context, req *rpc.EchoReq) (*rpc.EchoResp, error) {
	return &rpc.EchoResp{Message: req.Message, BaseResp: okResp()}, nil
}

// CreateTask 把 RPC 请求转成用例入参，执行后把结果转回 RPC 结构。
func (h *Handler) CreateTask(ctx context.Context, req *rpc.CreateTaskReq) (*rpc.CreateTaskResp, error) {
	in, err := toCreateInput(req)
	if err != nil {
		return &rpc.CreateTaskResp{BaseResp: errResp(err)}, nil
	}

	task, err := h.createTask.Execute(ctx, in)
	if err != nil {
		slog.ErrorContext(ctx, "create task failed", "err", err, "log_id", logID(req.Base))
		return &rpc.CreateTaskResp{BaseResp: errResp(err)}, nil
	}

	return &rpc.CreateTaskResp{Task: toThriftTask(task), BaseResp: okResp()}, nil
}

// —— 转换 ——

// toCreateInput 处理枚举、日期字符串和可空指针三种差异。
func toCreateInput(req *rpc.CreateTaskReq) (application.CreateTaskInput, error) {
	scheduled, err := parseDate(req.ScheduledDate)
	if err != nil {
		return application.CreateTaskInput{}, err
	}
	due, err := parseDate(req.DueDate)
	if err != nil {
		return application.CreateTaskInput{}, err
	}

	status := domain.StatusInbox
	if req.Status != nil {
		status = domain.Status(*req.Status)
	}
	priority := domain.PriorityNone
	if req.Priority != nil {
		priority = domain.Priority(*req.Priority)
	}

	var estimate *int
	if req.EstimateMinutes != nil {
		v := int(*req.EstimateMinutes)
		estimate = &v
	}

	return application.CreateTaskInput{
		UserID:          req.UserId,
		SpaceID:         deref(req.SpaceId),
		ProjectID:       req.ProjectId,
		ParentID:        req.ParentId,
		Title:           req.Title,
		Notes:           deref(req.Notes),
		Status:          status,
		Priority:        priority,
		ScheduledDate:   scheduled,
		DueDate:         due,
		EstimateMinutes: estimate,
	}, nil
}

// toThriftTask 把领域对象摊平成 RPC 的 Task。
func toThriftTask(t *domain.Task) *taskmodel.Task {
	return &taskmodel.Task{
		Id:              t.ID(),
		SpaceId:         t.SpaceID(),
		ProjectId:       t.ProjectID(),
		ParentId:        t.ParentID(),
		Title:           t.Title().String(),
		Notes:           t.Notes(),
		Status:          taskconst.TaskStatus(t.Status()),
		Priority:        taskconst.TaskPriority(t.Priority()),
		ScheduledDate:   formatDate(t.ScheduledDate()),
		DueDate:         formatDate(t.DueDate()),
		EstimateMinutes: int32Ptr(t.EstimateMinutes()),
		ActualMinutes:   int32(t.ActualMinutes()),
		CompletedAt:     formatTime(t.CompletedAt()),
		Version:         int32(t.Version()),
		CreatedAt:       t.CreatedAt().Format(time.RFC3339),
		UpdatedAt:       t.UpdatedAt().Format(time.RFC3339),
	}
}

// —— 小工具 ——

// parseDate 解析 YYYY-MM-DD；空指针或空串返回 nil。
func parseDate(s *string) (*time.Time, error) {
	if s == nil || *s == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", *s)
	if err != nil {
		return nil, fmt.Errorf("invalid date %q: %w", *s, err)
	}
	return &t, nil
}

// formatDate 把时间格式化成 YYYY-MM-DD，nil 原样返回。
func formatDate(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format("2006-01-02")
	return &s
}

// formatTime 格式化成 UTC ISO-8601。
func formatTime(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format(time.RFC3339)
	return &s
}

// int32Ptr 把 *int 转成 *int32，nil 保持 nil。
func int32Ptr(v *int) *int32 {
	if v == nil {
		return nil
	}
	n := int32(*v)
	return &n
}

// deref 解引用可空字符串，nil 当空串。
func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// logID 取调用上下文里的追踪号，取不到返回空串。
func logID(b *base.Base) string {
	if b == nil {
		return ""
	}
	return b.LogId
}

// okResp 构造成功响应。
func okResp() *base.BaseResp {
	return &base.BaseResp{StatusCode: codeOK}
}

// errResp 把错误翻译成业务状态码和面向用户的话。
func errResp(err error) *base.BaseResp {
	code, msg := classify(err)
	return &base.BaseResp{StatusCode: code, StatusMessage: msg}
}

// classify 把领域错误映射成状态码和用户可读的提示。
func classify(err error) (int32, string) {
	switch {
	case errors.Is(err, domain.ErrSpaceRequired):
		return codeInvalid, "缺少空间"
	case errors.Is(err, domain.ErrTitleRequired):
		return codeInvalid, "标题不能为空"
	case errors.Is(err, domain.ErrTitleTooLong):
		return codeInvalid, "标题超过 200 个字符"
	case errors.Is(err, domain.ErrNotesTooLong):
		return codeInvalid, "备注超过 20000 个字符"
	case errors.Is(err, domain.ErrEstimateRange):
		return codeInvalid, "预估耗时需在 0–10000 分钟之间"
	case errors.Is(err, domain.ErrDoneOnCreate):
		return codeInvalid, "不能创建已完成的任务"
	case errors.Is(err, domain.ErrInvalidStatus), errors.Is(err, domain.ErrInvalidPriority):
		return codeInvalid, "状态或优先级不合法"
	case errors.Is(err, domain.ErrTaskNotFound):
		return codeNotFound, "任务不存在"
	case errors.Is(err, application.ErrParentIsSubtask):
		return codeConflict, "父任务本身是子任务，只允许一层"
	case errors.Is(err, domain.ErrVersionConflict):
		return codeConflict, "任务已被修改，请刷新后重试"
	default:
		return codeInternal, "服务暂时不可用"
	}
}
