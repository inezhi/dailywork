// 完成任务用例测试
package application

import (
	"context"
	"errors"
	"testing"

	"github.com/inezhi/dailywork/services/task/internal/domain"
)

// 造一个指定状态和版本的任务
func completeTaskFixture(id string, userID string, status domain.Status, version int) *domain.Task {
	return domain.Reconstitute(
		id, userID, "s1", nil, nil,
		"任务"+id, "",
		status, domain.PriorityNone,
		nil, nil, nil, 0,
		nil, version,
		testNow, testNow,
	)
}

func TestCompleteTask(t *testing.T) {
	repo := newFakeRepo()
	repo.tasks["t1"] = completeTaskFixture("t1", "u1", domain.StatusDoing, 2)
	uc := NewCompleteTask(repo, fixedClock{})

	task, err := uc.Execute(context.Background(), CompleteTaskInput{
		UserID: "u1", TaskID: "t1", ExpectedVersion: 2,
	})
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if task.Status() != domain.StatusDone {
		t.Errorf("status = %v", task.Status())
	}
	if task.CompletedAt() == nil || !task.CompletedAt().Equal(testNow) {
		t.Errorf("completedAt = %v", task.CompletedAt())
	}
	if repo.savedEvent == nil {
		t.Fatal("没有记录事件")
	}
	if repo.savedEvent.TaskID != "t1" || repo.savedEvent.UserID != "u1" {
		t.Errorf("event = %+v", repo.savedEvent)
	}
	if !repo.savedEvent.CompletedAt.Equal(testNow) {
		t.Errorf("event completedAt = %v", repo.savedEvent.CompletedAt)
	}
}

func TestCompleteTaskWrongUser(t *testing.T) {
	repo := newFakeRepo()
	repo.tasks["t1"] = completeTaskFixture("t1", "u1", domain.StatusDoing, 1)
	uc := NewCompleteTask(repo, fixedClock{})

	_, err := uc.Execute(context.Background(), CompleteTaskInput{
		UserID: "someone-else", TaskID: "t1", ExpectedVersion: 1,
	})
	if !errors.Is(err, domain.ErrTaskNotFound) {
		t.Errorf("err = %v", err)
	}
}

func TestCompleteTaskVersionConflict(t *testing.T) {
	repo := newFakeRepo()
	repo.tasks["t1"] = completeTaskFixture("t1", "u1", domain.StatusDoing, 2)
	uc := NewCompleteTask(repo, fixedClock{})

	_, err := uc.Execute(context.Background(), CompleteTaskInput{
		UserID: "u1", TaskID: "t1", ExpectedVersion: 1,
	})
	if !errors.Is(err, domain.ErrVersionConflict) {
		t.Errorf("err = %v", err)
	}
}

func TestCompleteTaskAlreadyDone(t *testing.T) {
	repo := newFakeRepo()
	repo.tasks["t1"] = completeTaskFixture("t1", "u1", domain.StatusDone, 2)
	uc := NewCompleteTask(repo, fixedClock{})

	_, err := uc.Execute(context.Background(), CompleteTaskInput{
		UserID: "u1", TaskID: "t1", ExpectedVersion: 2,
	})
	if !errors.Is(err, domain.ErrAlreadyDone) {
		t.Errorf("err = %v", err)
	}
}

func TestCompleteTaskSaveError(t *testing.T) {
	repo := newFakeRepo()
	repo.tasks["t1"] = completeTaskFixture("t1", "u1", domain.StatusDoing, 1)
	repo.saveErr = errors.New("db down")
	uc := NewCompleteTask(repo, fixedClock{})

	_, err := uc.Execute(context.Background(), CompleteTaskInput{
		UserID: "u1", TaskID: "t1", ExpectedVersion: 1,
	})
	if err == nil {
		t.Fatal("应该返回错误")
	}
}

func TestCompleteTaskNotFound(t *testing.T) {
	repo := newFakeRepo()
	uc := NewCompleteTask(repo, fixedClock{})

	_, err := uc.Execute(context.Background(), CompleteTaskInput{
		UserID: "u1", TaskID: "missing", ExpectedVersion: 1,
	})
	if err == nil {
		t.Fatal("应该返回错误")
	}
}
