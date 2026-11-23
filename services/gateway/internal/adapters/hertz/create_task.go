// 本文件实现 POST /api/v1/tasks：HTTP 请求 → RPC 调用 → HTTP 响应。
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
	"github.com/inezhi/dailywork/api/gen/taskmodel"
)

// 处理 /api/v1/tasks。
type CreateTask struct {
	taskClient dailyworkservice.Client
}

func NewCreateTask(taskClient dailyworkservice.Client) *CreateTask {
	return &CreateTask{taskClient: taskClient}
}

func (h *CreateTask) Handle(ctx context.Context, c *app.RequestContext) {
	requestID, ok := beginRequest(c)
	if !ok {
		return
	}

	req, ok := parseCreateTaskRequest(c, requestID)
	if !ok {
		return
	}

	task, ok := h.callCreateTask(c, ctx, req, requestID)
	if !ok {
		return
	}

	writeCreateTaskResponse(c, task, requestID)
}

// parseCreateTaskRequest 解析请求体并做契约级校验。
func parseCreateTaskRequest(c *app.RequestContext, requestID string) (api.CreateTaskReq, bool) {
	body, err := c.Body()
	if err != nil {
		writeError(c, 400, api.VALIDATIONFAILED, "读取请求体失败", requestID)
		return api.CreateTaskReq{}, false
	}

	// UUID、日期这类字段格式不对时，这里就会报错
	var req api.CreateTaskReq
	err = json.Unmarshal(body, &req)
	if err != nil {
		writeError(c, 400, api.VALIDATIONFAILED, "请求体不是合法 JSON 或字段格式不对", requestID)
		return api.CreateTaskReq{}, false
	}

	titleLength := utf8.RuneCountInString(req.Title)
	if titleLength == 0 || titleLength > 200 {
		writeError(c, 400, api.VALIDATIONFAILED, "title 长度必须在 1 到 200 之间", requestID)
		return api.CreateTaskReq{}, false
	}

	if req.Notes != nil && utf8.RuneCountInString(*req.Notes) > 20000 {
		writeError(c, 400, api.VALIDATIONFAILED, "notes 不能超过 20000 字符", requestID)
		return api.CreateTaskReq{}, false
	}

	// 生成类型是字符串，JSON 里写 "done" 也能解出来，所以这里要单独拦
	if req.Status != nil && !validCreateStatus(*req.Status) {
		writeError(c, 400, api.VALIDATIONFAILED, "status 只能是 inbox/next/doing/waiting/blocked", requestID)
		return api.CreateTaskReq{}, false
	}

	if req.Priority != nil && !validPriority(*req.Priority) {
		writeError(c, 400, api.VALIDATIONFAILED, "priority 只能是 none/low/medium/high/urgent", requestID)
		return api.CreateTaskReq{}, false
	}

	if req.EstimateMinutes != nil && (*req.EstimateMinutes < 0 || *req.EstimateMinutes > 10000) {
		writeError(c, 400, api.VALIDATIONFAILED, "estimateMinutes 必须在 0 到 10000 之间", requestID)
		return api.CreateTaskReq{}, false
	}

	return req, true
}

// validCreateStatus 判断创建请求里的状态是否合法；done 不允许在创建时出现。
func validCreateStatus(status api.CreateTaskStatus) bool {
	switch status {
	case api.CreateTaskStatusInbox,
		api.CreateTaskStatusNext,
		api.CreateTaskStatusDoing,
		api.CreateTaskStatusWaiting,
		api.CreateTaskStatusBlocked:
		return true
	}
	return false
}

// validPriority 判断优先级是否在五个合法值里。
func validPriority(priority api.TaskPriority) bool {
	switch priority {
	case api.None, api.Low, api.Medium, api.High, api.Urgent:
		return true
	}
	return false
}

// toRPCCreateTask 把 HTTP 请求转成 Thrift 请求；没传的可选字段保持 nil。
func toRPCCreateTask(req api.CreateTaskReq, requestID string) *rpc.CreateTaskReq {
	rpcReq := &rpc.CreateTaskReq{
		// 切片 1 还没有登录，用户 id 先写死；第 6 步挪进配置
		UserId: "u-local",
		Title:  req.Title,
		Base:   &base.Base{LogId: requestID, Caller: "gateway"},
	}

	if req.SpaceId != nil {
		value := req.SpaceId.String()
		rpcReq.SpaceId = &value
	}
	if req.ProjectId != nil {
		value := req.ProjectId.String()
		rpcReq.ProjectId = &value
	}
	if req.ParentId != nil {
		value := req.ParentId.String()
		rpcReq.ParentId = &value
	}

	// 两边都是 *string，直接传
	rpcReq.Notes = req.Notes

	if req.Status != nil {
		value := toThriftStatus(*req.Status)
		rpcReq.Status = &value
	}
	if req.Priority != nil {
		value := toThriftPriority(*req.Priority)
		rpcReq.Priority = &value
	}

	rpcReq.ScheduledDate = formatDate(req.ScheduledDate)
	rpcReq.DueDate = formatDate(req.DueDate)

	if req.EstimateMinutes != nil {
		value := int32(*req.EstimateMinutes)
		rpcReq.EstimateMinutes = &value
	}

	return rpcReq
}

// callCreateTask 调用下游 RPC；失败时直接写 500。
func (h *CreateTask) callCreateTask(c *app.RequestContext, ctx context.Context, req api.CreateTaskReq, requestID string) (*taskmodel.Task, bool) {
	rpcReq := toRPCCreateTask(req, requestID)

	resp, err := h.taskClient.CreateTask(ctx, rpcReq)
	if err != nil {
		slog.Error("call task create", "err", err, "requestId", requestID)
		writeError(c, 500, api.INTERNAL, "调用 task 服务失败", requestID)
		return nil, false
	}

	// 业务错误先一律 500，第 5 步做状态码映射
	if resp.BaseResp.StatusCode != 0 {
		slog.Error("task create failed",
			"status", resp.BaseResp.StatusCode,
			"message", resp.BaseResp.StatusMessage,
			"requestId", requestID,
		)
		writeError(c, 500, api.INTERNAL, resp.BaseResp.StatusMessage, requestID)
		return nil, false
	}

	// 正常响应一定带 task；没有就是服务端的问题
	if resp.Task == nil {
		slog.Error("task create returned nil task", "requestId", requestID)
		writeError(c, 500, api.INTERNAL, "服务端没有返回任务", requestID)
		return nil, false
	}

	return resp.Task, true
}

// writeCreateTaskResponse 把 Thrift 任务转成 HTTP 任务，按契约包成 {data, meta}。
func writeCreateTaskResponse(c *app.RequestContext, task *taskmodel.Task, requestID string) {
	httpTask, err := toHTTPTask(task)
	if err != nil {
		slog.Error("convert task", "err", err, "requestId", requestID)
		writeError(c, 500, api.INTERNAL, "转换任务数据失败", requestID)
		return
	}

	c.JSON(200, api.TaskEnvelope{
		Data: httpTask,
		Meta: api.Meta{RequestId: requestID},
	})
}
