// 今天页的 RPC 适配器
package kitex

import (
	"context"
	"time"

	"github.com/inezhi/dailywork/api/gen/base"
	"github.com/inezhi/dailywork/api/gen/rpc"
	"github.com/inezhi/dailywork/api/gen/taskconst"
	"github.com/inezhi/dailywork/api/gen/taskmodel"
	"github.com/inezhi/dailywork/services/task/internal/application"
	"github.com/inezhi/dailywork/services/task/internal/domain"
)

// 日期格式
const dateLayout = "2006-01-02"

// 今天页：按客户端日期分六组
func (h *Handler) ListToday(ctx context.Context, req *rpc.ListTodayReq) (*rpc.ListTodayResp, error) {
	date, err := time.Parse(dateLayout, req.Date)
	if err != nil {
		return &rpc.ListTodayResp{
			BaseResp: &base.BaseResp{StatusCode: codeInvalid, StatusMessage: "日期格式必须是 YYYY-MM-DD"},
		}, nil
	}

	result, err := h.listToday.Execute(ctx, req.UserId, date)
	if err != nil {
		return &rpc.ListTodayResp{BaseResp: errResp(err)}, nil
	}

	groups := make([]*rpc.TodayGroup, 0, len(result.Groups))
	for _, group := range result.Groups {
		kind, ok := toThriftGroupKind(group.Kind)
		if !ok {
			continue
		}
		groups = append(groups, &rpc.TodayGroup{
			Kind:            kind,
			Tasks:           toThriftTasks(group.Tasks),
			Count:           int32(len(group.Tasks)),
			EstimateMinutes: int32(group.EstimateMinutes),
		})
	}

	return &rpc.ListTodayResp{Groups: groups, BaseResp: okResp()}, nil
}

// 应用层分组转 thrift 枚举
func toThriftGroupKind(kind application.TodayGroupKind) (taskconst.TodayGroupKind, bool) {
	switch kind {
	case application.TodayOverdue:
		return taskconst.TodayGroupKind_OVERDUE, true
	case application.TodayDueToday:
		return taskconst.TodayGroupKind_DUE_TODAY, true
	case application.TodayPlannedToday:
		return taskconst.TodayGroupKind_PLANNED_TODAY, true
	case application.TodayDoing:
		return taskconst.TodayGroupKind_DOING, true
	case application.TodayNext:
		return taskconst.TodayGroupKind_NEXT, true
	case application.TodayCompletedToday:
		return taskconst.TodayGroupKind_COMPLETED_TODAY, true
	}
	return 0, false
}

// 批量转 thrift 任务
func toThriftTasks(tasks []*domain.Task) []*taskmodel.Task {
	result := make([]*taskmodel.Task, 0, len(tasks))
	for _, task := range tasks {
		result = append(result, toThriftTask(task))
	}
	return result
}
