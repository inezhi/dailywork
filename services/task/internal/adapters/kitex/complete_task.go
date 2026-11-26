// 完成任务的 RPC 适配器
package kitex

import (
	"context"

	"github.com/inezhi/dailywork/api/gen/rpc"
	"github.com/inezhi/dailywork/services/task/internal/application"
)

// 完成任务
func (h *Handler) CompleteTask(ctx context.Context, req *rpc.CompleteTaskReq) (*rpc.CompleteTaskResp, error) {
	task, err := h.completeTask.Execute(ctx, application.CompleteTaskInput{
		UserID:          req.UserId,
		TaskID:          req.TaskId,
		ExpectedVersion: int(req.ExpectedVersion),
	})
	if err != nil {
		return &rpc.CompleteTaskResp{BaseResp: errResp(err)}, nil
	}
	return &rpc.CompleteTaskResp{Task: toThriftTask(task), BaseResp: okResp()}, nil
}
