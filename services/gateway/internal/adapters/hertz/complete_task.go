// 完成任务的 HTTP 适配器
package hertz

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/cloudwego/hertz/pkg/app"

	"github.com/inezhi/dailywork/api/gen/base"
	api "github.com/inezhi/dailywork/api/gen/http/v1"
	"github.com/inezhi/dailywork/api/gen/rpc"
	"github.com/inezhi/dailywork/api/gen/rpc/dailyworkservice"
)

// CompleteTask 处理 POST /api/v1/tasks/{id}/complete
type CompleteTask struct {
	taskClient dailyworkservice.Client
}

// 注入 RPC 客户端
func NewCompleteTask(taskClient dailyworkservice.Client) *CompleteTask {
	return &CompleteTask{taskClient: taskClient}
}

// 完成任务
func (h *CompleteTask) Handle(ctx context.Context, c *app.RequestContext) {
	requestID := requestIDFrom(c)

	taskID := c.Param("id")
	if taskID == "" {
		writeError(c, 400, api.VALIDATIONFAILED, "任务 id 必填", requestID)
		return
	}

	body, err := c.Body()
	if err != nil {
		writeError(c, 400, api.VALIDATIONFAILED, "读取请求体失败", requestID)
		return
	}

	var req api.CompleteTaskReq
	err = json.Unmarshal(body, &req)
	if err != nil {
		writeError(c, 400, api.VALIDATIONFAILED, "请求体不是合法 JSON", requestID)
		return
	}
	if req.ExpectedVersion < 1 {
		writeError(c, 400, api.VALIDATIONFAILED, "expectedVersion 必须大于 0", requestID)
		return
	}

	resp, err := h.taskClient.CompleteTask(ctx, &rpc.CompleteTaskReq{
		UserId:          userIDFrom(c),
		TaskId:          taskID,
		ExpectedVersion: int32(req.ExpectedVersion),
		Base:            &base.Base{LogId: requestID, Caller: "gateway"},
	})
	if err != nil {
		slog.Error("call task complete", "err", err, "requestId", requestID)
		writeError(c, 500, api.INTERNAL, "调用 task 服务失败", requestID)
		return
	}
	if resp.BaseResp.StatusCode != 0 {
		writeRPCError(c, resp.BaseResp.StatusCode, resp.BaseResp.StatusMessage, requestID)
		return
	}
	if resp.Task == nil {
		slog.Error("complete returned nil task", "requestId", requestID)
		writeError(c, 500, api.INTERNAL, "服务端没有返回任务", requestID)
		return
	}

	httpTask, err := toHTTPTask(resp.Task)
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
