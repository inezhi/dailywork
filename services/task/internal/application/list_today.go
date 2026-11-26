// 今天页：按客户端日期把任务分成六组
package application

import (
	"context"
	"fmt"
	"time"

	"github.com/inezhi/dailywork/services/task/internal/domain"
)

// 分组；数值即优先级
type TodayGroupKind int

const (
	TodayOverdue TodayGroupKind = iota + 1
	TodayDueToday
	TodayPlannedToday
	TodayDoing
	TodayNext
	TodayCompletedToday
)

// 一个分组
type TodayGroup struct {
	Kind            TodayGroupKind
	Tasks           []*domain.Task
	EstimateMinutes int
}

// 今天页结果
type TodayResult struct {
	Date   time.Time
	Groups []TodayGroup
}

// ListToday 查询候选任务并分组
type ListToday struct {
	tasks TaskRepository
}

// 注入仓储
func NewListToday(tasks TaskRepository) *ListToday {
	return &ListToday{tasks: tasks}
}

// 按优先级分六组，一个任务只进最高优先级的一组
func (uc *ListToday) Execute(ctx context.Context, userID string, date time.Time) (*TodayResult, error) {
	tasks, err := uc.tasks.ListForToday(ctx, userID, date)
	if err != nil {
		return nil, fmt.Errorf("list today tasks: %w", err)
	}

	groups := emptyGroups()
	index := groupIndex()

	for _, task := range tasks {
		kind, ok := groupFor(task, date)
		if !ok {
			continue
		}
		groups[index[kind]].Tasks = append(groups[index[kind]].Tasks, task)
	}

	for i := range groups {
		groups[i].EstimateMinutes = sumEstimate(groups[i].Tasks)
	}

	return &TodayResult{Date: date, Groups: groups}, nil
}

// 六个空分组，顺序固定
func emptyGroups() []TodayGroup {
	kinds := []TodayGroupKind{
		TodayOverdue,
		TodayDueToday,
		TodayPlannedToday,
		TodayDoing,
		TodayNext,
		TodayCompletedToday,
	}

	groups := make([]TodayGroup, len(kinds))
	for i, kind := range kinds {
		groups[i] = TodayGroup{Kind: kind, Tasks: []*domain.Task{}}
	}
	return groups
}

// 分组到下标
func groupIndex() map[TodayGroupKind]int {
	index := make(map[TodayGroupKind]int)
	for i, kind := range []TodayGroupKind{
		TodayOverdue,
		TodayDueToday,
		TodayPlannedToday,
		TodayDoing,
		TodayNext,
		TodayCompletedToday,
	} {
		index[kind] = i
	}
	return index
}

// 判定任务属于哪一组；不属于任何组返回 false
func groupFor(task *domain.Task, today time.Time) (TodayGroupKind, bool) {
	done := task.Status() == domain.StatusDone

	if !done && task.DueDate() != nil {
		due := *task.DueDate()
		if due.Before(today) {
			return TodayOverdue, true
		}
		if sameDay(due, today) {
			return TodayDueToday, true
		}
	}

	if !done && task.ScheduledDate() != nil && sameDay(*task.ScheduledDate(), today) {
		return TodayPlannedToday, true
	}

	switch task.Status() {
	case domain.StatusDoing:
		return TodayDoing, true
	case domain.StatusNext, domain.StatusInbox:
		return TodayNext, true
	case domain.StatusDone:
		if task.CompletedAt() != nil && sameDay(*task.CompletedAt(), today) {
			return TodayCompletedToday, true
		}
	}

	return 0, false
}

// 是否是同一天
func sameDay(a time.Time, b time.Time) bool {
	return a.Year() == b.Year() && a.Month() == b.Month() && a.Day() == b.Day()
}

// 组内预估合计，没填预估的任务不算
func sumEstimate(tasks []*domain.Task) int {
	total := 0
	for _, task := range tasks {
		if task.EstimateMinutes() != nil {
			total += *task.EstimateMinutes()
		}
	}
	return total
}
