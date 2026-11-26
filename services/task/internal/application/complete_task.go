// 完成任务用例
package application

import (
	"context"
	"fmt"

	"github.com/inezhi/dailywork/services/task/internal/domain"
)

// 完成任务的入参
type CompleteTaskInput struct {
	UserID          string
	TaskID          string
	ExpectedVersion int
}

// CompleteTask 完成任务，并在同一事务里记录待发事件
type CompleteTask struct {
	tasks TaskRepository
	clock Clock
}

// 注入依赖
func NewCompleteTask(tasks TaskRepository, clock Clock) *CompleteTask {
	return &CompleteTask{tasks: tasks, clock: clock}
}

// 加载、校验、完成、保存
func (uc *CompleteTask) Execute(ctx context.Context, in CompleteTaskInput) (*domain.Task, error) {
	task, err := uc.tasks.FindByID(ctx, in.TaskID)
	if err != nil {
		return nil, err
	}

	// 别人的任务当作不存在，避免泄露
	if task.UserID() != in.UserID {
		return nil, domain.ErrTaskNotFound
	}
	if task.Version() != in.ExpectedVersion {
		return nil, domain.ErrVersionConflict
	}

	err = task.Complete(uc.clock.Now())
	if err != nil {
		return nil, err
	}

	event := domain.TaskCompleted{
		TaskID:      task.ID(),
		UserID:      task.UserID(),
		SpaceID:     task.SpaceID(),
		Title:       task.Title().String(),
		CompletedAt: *task.CompletedAt(),
	}

	err = uc.tasks.SaveWithEvent(ctx, task, event)
	if err != nil {
		return nil, fmt.Errorf("save completed task: %w", err)
	}
	return task, nil
}
