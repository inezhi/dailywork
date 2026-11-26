// 今天页的 HTTP 适配器
package hertz

import (
	"context"
	"log/slog"
	"time"

	"github.com/cloudwego/hertz/pkg/app"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/inezhi/dailywork/api/gen/base"
	api "github.com/inezhi/dailywork/api/gen/http/v1"
	"github.com/inezhi/dailywork/api/gen/rpc"
	"github.com/inezhi/dailywork/api/gen/rpc/dailyworkservice"
	"github.com/inezhi/dailywork/api/gen/taskconst"
)

// 日期格式
const dateLayout = "2006-01-02"

// Today 处理 GET /api/v1/today
type Today struct {
	taskClient dailyworkservice.Client
}

// 注入 RPC 客户端
func NewToday(taskClient dailyworkservice.Client) *Today {
	return &Today{taskClient: taskClient}
}

// 按客户端日期查询今天页
func (h *Today) Handle(ctx context.Context, c *app.RequestContext) {
	requestID := requestIDFrom(c)

	// 日期由客户端传，服务端不用自己的时区猜
	dateValue := c.Query("date")
	if dateValue == "" {
		writeError(c, 400, api.VALIDATIONFAILED, "date 必填，格式 YYYY-MM-DD", requestID)
		return
	}
	date, err := time.Parse(dateLayout, dateValue)
	if err != nil {
		writeError(c, 400, api.VALIDATIONFAILED, "date 格式必须是 YYYY-MM-DD", requestID)
		return
	}

	resp, err := h.taskClient.ListToday(ctx, &rpc.ListTodayReq{
		UserId: userIDFrom(c),
		Date:   dateValue,
		Base:   &base.Base{LogId: requestID, Caller: "gateway"},
	})
	if err != nil {
		slog.Error("call task list today", "err", err, "requestId", requestID)
		writeError(c, 500, api.INTERNAL, "调用 task 服务失败", requestID)
		return
	}
	if resp.BaseResp.StatusCode != 0 {
		writeRPCError(c, resp.BaseResp.StatusCode, resp.BaseResp.StatusMessage, requestID)
		return
	}

	groups, ok := toHTTPTodayGroups(resp.Groups)
	if !ok {
		slog.Error("convert today groups failed", "requestId", requestID)
		writeError(c, 500, api.INTERNAL, "转换任务数据失败", requestID)
		return
	}

	c.JSON(200, api.TodayEnvelope{
		Data: api.TodayData{
			Date:   openapi_types.Date{Time: date},
			Groups: groups,
		},
		Meta: api.Meta{RequestId: requestID},
	})
}

// 把 thrift 分组转成 HTTP 分组
func toHTTPTodayGroups(groups []*rpc.TodayGroup) ([]api.TodayGroup, bool) {
	result := make([]api.TodayGroup, 0, len(groups))

	for _, group := range groups {
		tasks := make([]api.Task, 0, len(group.Tasks))
		for _, task := range group.Tasks {
			httpTask, err := toHTTPTask(task)
			if err != nil {
				return nil, false
			}
			tasks = append(tasks, httpTask)
		}

		kind, ok := toHTTPGroupKind(group.Kind)
		if !ok {
			return nil, false
		}

		result = append(result, api.TodayGroup{
			Kind:            kind,
			Tasks:           tasks,
			Count:           int(group.Count),
			EstimateMinutes: int(group.EstimateMinutes),
		})
	}

	return result, true
}

// thrift 分组枚举转 HTTP 枚举
func toHTTPGroupKind(kind taskconst.TodayGroupKind) (api.TodayGroupKind, bool) {
	switch kind {
	case taskconst.TodayGroupKind_OVERDUE:
		return api.TodayGroupKindOverdue, true
	case taskconst.TodayGroupKind_DUE_TODAY:
		return api.TodayGroupKindDueToday, true
	case taskconst.TodayGroupKind_PLANNED_TODAY:
		return api.TodayGroupKindPlannedToday, true
	case taskconst.TodayGroupKind_DOING:
		return api.TodayGroupKindDoing, true
	case taskconst.TodayGroupKind_NEXT:
		return api.TodayGroupKindNext, true
	case taskconst.TodayGroupKind_COMPLETED_TODAY:
		return api.TodayGroupKindCompletedToday, true
	}
	return "", false
}
