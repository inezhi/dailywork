// 今天分组用例测试
package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/inezhi/dailywork/services/task/internal/domain"
)

// 造一个任务，只填分组需要的字段
func todayTask(
	id string,
	status domain.Status,
	scheduled *time.Time,
	due *time.Time,
	completed *time.Time,
	estimate *int,
) *domain.Task {
	return domain.Reconstitute(
		id, "u1", "s1", nil, nil,
		"任务"+id, "",
		status, domain.PriorityNone,
		scheduled, due,
		estimate, 0,
		completed, 1,
		testNow, testNow,
	)
}

// 取某一组的任务 id
func groupIDs(result *TodayResult, kind TodayGroupKind) []string {
	for _, group := range result.Groups {
		if group.Kind != kind {
			continue
		}
		ids := make([]string, 0, len(group.Tasks))
		for _, task := range group.Tasks {
			ids = append(ids, task.ID())
		}
		return ids
	}
	return nil
}

// 取某一组的预估合计
func groupEstimate(result *TodayResult, kind TodayGroupKind) int {
	for _, group := range result.Groups {
		if group.Kind == kind {
			return group.EstimateMinutes
		}
	}
	return 0
}

func TestListTodayGroups(t *testing.T) {
	day := time.Date(2026, 11, 26, 0, 0, 0, 0, time.UTC)
	yesterday := day.AddDate(0, 0, -1)
	tomorrow := day.AddDate(0, 0, 1)
	estimate30 := 30
	estimate45 := 45

	repo := newFakeRepo()
	repo.todayTasks = []*domain.Task{
		todayTask("overdue", domain.StatusDoing, nil, &yesterday, nil, &estimate30),
		todayTask("due", domain.StatusInbox, nil, &day, nil, nil),
		todayTask("planned", domain.StatusDoing, &day, nil, nil, &estimate45),
		todayTask("doing", domain.StatusDoing, nil, nil, nil, nil),
		todayTask("next", domain.StatusNext, nil, nil, nil, nil),
		todayTask("inbox", domain.StatusInbox, nil, nil, nil, nil),
		todayTask("doneToday", domain.StatusDone, nil, nil, &day, nil),
		todayTask("doneOld", domain.StatusDone, nil, nil, &yesterday, nil),
		todayTask("waiting", domain.StatusWaiting, nil, nil, nil, nil),
		todayTask("future", domain.StatusInbox, &tomorrow, &tomorrow, nil, nil),
	}

	result, err := NewListToday(repo).Execute(context.Background(), "u1", day, time.UTC)
	if err != nil {
		t.Fatalf("err = %v", err)
	}

	cases := []struct {
		kind TodayGroupKind
		want []string
	}{
		{TodayOverdue, []string{"overdue"}},
		{TodayDueToday, []string{"due"}},
		{TodayPlannedToday, []string{"planned"}},
		{TodayDoing, []string{"doing"}},
		{TodayNext, []string{"next", "inbox", "future"}},
		{TodayCompletedToday, []string{"doneToday"}},
	}

	for _, tc := range cases {
		got := groupIDs(result, tc.kind)
		if len(got) != len(tc.want) {
			t.Errorf("kind %d: got %v, want %v", tc.kind, got, tc.want)
			continue
		}
		for i := range got {
			if got[i] != tc.want[i] {
				t.Errorf("kind %d: got %v, want %v", tc.kind, got, tc.want)
			}
		}
	}

	if groupEstimate(result, TodayOverdue) != 30 {
		t.Errorf("overdue estimate = %d", groupEstimate(result, TodayOverdue))
	}
	if groupEstimate(result, TodayPlannedToday) != 45 {
		t.Errorf("planned estimate = %d", groupEstimate(result, TodayPlannedToday))
	}
}

func TestListTodayEmptyGroups(t *testing.T) {
	day := time.Date(2026, 11, 26, 0, 0, 0, 0, time.UTC)
	result, err := NewListToday(newFakeRepo()).Execute(context.Background(), "u1", day, time.UTC)
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if len(result.Groups) != 6 {
		t.Fatalf("groups = %d, want 6", len(result.Groups))
	}
	for _, group := range result.Groups {
		if group.Tasks == nil {
			t.Errorf("kind %d: tasks 应该为空数组而不是 nil", group.Kind)
		}
		if len(group.Tasks) != 0 {
			t.Errorf("kind %d: 不应该有任务", group.Kind)
		}
	}
}

func TestListTodayRepoError(t *testing.T) {
	repo := newFakeRepo()
	repo.listErr = errors.New("db down")
	day := time.Date(2026, 11, 26, 0, 0, 0, 0, time.UTC)

	_, err := NewListToday(repo).Execute(context.Background(), "u1", day, time.UTC)
	if err == nil {
		t.Fatal("应该返回错误")
	}
}

func TestListTodayCompletedTimezone(t *testing.T) {
	// 北京时间 2026-11-27 00:30 = UTC 2026-11-26 16:30
	completed := time.Date(2026, 11, 26, 16, 30, 0, 0, time.UTC)
	day := time.Date(2026, 11, 27, 0, 0, 0, 0, time.UTC)
	task := todayTask("done", domain.StatusDone, nil, nil, &completed, nil)

	repo := newFakeRepo()
	repo.todayTasks = []*domain.Task{task}

	shanghai, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		t.Fatalf("load location: %v", err)
	}

	result, err := NewListToday(repo).Execute(context.Background(), "u1", day, shanghai)
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if ids := groupIDs(result, TodayCompletedToday); len(ids) != 1 {
		t.Errorf("东八区应该算今天完成: %v", ids)
	}

	resultUTC, err := NewListToday(repo).Execute(context.Background(), "u1", day, time.UTC)
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if ids := groupIDs(resultUTC, TodayCompletedToday); len(ids) != 0 {
		t.Errorf("UTC 下不应该算今天完成: %v", ids)
	}
}
