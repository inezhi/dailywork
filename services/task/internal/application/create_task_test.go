package application

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/inezhi/dailywork/services/task/internal/domain"
)

var testNow = time.Date(2026, 11, 6, 9, 0, 0, 0, time.UTC)

// fakeRepo 是 TaskRepository 的内存实现，测试用。
// 一个 map 就够了——不需要数据库。
type fakeRepo struct {
	tasks      map[string]*domain.Task
	saveErr    error
	todayTasks []*domain.Task
	listErr    error
	savedEvent *domain.TaskCompleted
}

func newFakeRepo() *fakeRepo { return &fakeRepo{tasks: map[string]*domain.Task{}} }

func (f *fakeRepo) Save(_ context.Context, t *domain.Task) error {
	if f.saveErr != nil {
		return f.saveErr
	}
	f.tasks[t.ID()] = t
	return nil
}

func (f *fakeRepo) FindByID(_ context.Context, id string) (*domain.Task, error) {
	t, ok := f.tasks[id]
	if !ok {
		return nil, fmt.Errorf("task %s not found", id)
	}
	return t, nil
}

// 返回预设的今天候选任务
func (f *fakeRepo) ListForToday(_ context.Context, userID string, day time.Time) ([]*domain.Task, error) {
	if f.listErr != nil {
		return nil, f.listErr
	}
	return f.todayTasks, nil
}

// 保存任务并记录事件
func (f *fakeRepo) SaveWithEvent(_ context.Context, t *domain.Task, event domain.TaskCompleted) error {
	if f.saveErr != nil {
		return f.saveErr
	}
	f.tasks[t.ID()] = t
	f.savedEvent = &event
	return nil
}

// fakeIDs 每次返回递增的 ID，测试里可以预期。
type fakeIDs struct{ n int }

func (f *fakeIDs) NewID() string {
	f.n++
	return fmt.Sprintf("task-%d", f.n)
}

// fixedClock 永远返回同一个时间。
type fixedClock struct{}

func (fixedClock) Now() time.Time { return testNow }

func newUseCase(repo TaskRepository) *CreateTask {
	return NewCreateTask(repo, &fakeIDs{}, fixedClock{})
}

func TestCreateTask(t *testing.T) {
	repo := newFakeRepo()
	uc := newUseCase(repo)

	task, err := uc.Execute(context.Background(), CreateTaskInput{
		UserID:   "u1",
		SpaceID:  "s1",
		Title:    "写周报",
		Status:   domain.StatusInbox,
		Priority: domain.PriorityNone,
	})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}

	if task.ID() != "task-1" {
		t.Errorf("id = %q, want task-1", task.ID())
	}
	if task.Version() != 1 {
		t.Errorf("version = %d, want 1", task.Version())
	}
	if !task.CreatedAt().Equal(testNow) {
		t.Errorf("createdAt = %v, want %v", task.CreatedAt(), testNow)
	}

	// 任务确实被存下来了
	if _, ok := repo.tasks["task-1"]; !ok {
		t.Error("task was not saved")
	}
}

func TestCreateSubtaskInheritsParentSpaceAndProject(t *testing.T) {
	repo := newFakeRepo()
	uc := newUseCase(repo)

	parent := seedTask(t, repo, "parent-1", "s1", "p1")
	parentID := parent.ID()

	// 请求里故意传了不同的 space 和 project，应该被父任务的覆盖
	otherSpace, otherProject := "s2", "p2"
	task, err := uc.Execute(context.Background(), CreateTaskInput{
		UserID:    "u1",
		SpaceID:   otherSpace,
		ProjectID: &otherProject,
		ParentID:  &parentID,
		Title:     "写周报：本周进展",
		Status:    domain.StatusInbox,
		Priority:  domain.PriorityNone,
	})
	if err != nil {
		t.Fatalf("execute: %v", err)
	}

	if task.SpaceID() != "s1" {
		t.Errorf("spaceID = %q, want s1 (inherited)", task.SpaceID())
	}
	if task.ProjectID() == nil || *task.ProjectID() != "p1" {
		t.Errorf("projectID = %v, want p1 (inherited)", task.ProjectID())
	}
}

func TestCreateTaskRejectsSubtaskAsParent(t *testing.T) {
	repo := newFakeRepo()
	uc := newUseCase(repo)

	parent := seedTask(t, repo, "parent-1", "s1", "")
	child := seedTaskWithParent(t, repo, "child-1", "s1", "", parent.ID())
	childID := child.ID()

	_, err := uc.Execute(context.Background(), CreateTaskInput{
		UserID:   "u1",
		SpaceID:  "s1",
		ParentID: &childID,
		Title:    "不允许的第二层",
		Status:   domain.StatusInbox,
		Priority: domain.PriorityNone,
	})
	if !errors.Is(err, ErrParentIsSubtask) {
		t.Fatalf("err = %v, want ErrParentIsSubtask", err)
	}
}

func TestCreateTaskPropagatesDomainError(t *testing.T) {
	uc := newUseCase(newFakeRepo())

	_, err := uc.Execute(context.Background(), CreateTaskInput{
		UserID:   "u1",
		SpaceID:  "s1",
		Title:    "   ",
		Status:   domain.StatusInbox,
		Priority: domain.PriorityNone,
	})
	if !errors.Is(err, domain.ErrTitleRequired) {
		t.Fatalf("err = %v, want domain.ErrTitleRequired", err)
	}
}

func TestCreateTaskWrapsSaveError(t *testing.T) {
	repo := newFakeRepo()
	repo.saveErr = errors.New("disk full")
	uc := newUseCase(repo)

	_, err := uc.Execute(context.Background(), CreateTaskInput{
		UserID:   "u1",
		SpaceID:  "s1",
		Title:    "写周报",
		Status:   domain.StatusInbox,
		Priority: domain.PriorityNone,
	})
	if err == nil || !errors.Is(err, repo.saveErr) {
		t.Fatalf("err = %v, want wrapped save error", err)
	}
}

// —— 测试辅助 ——

func seedTask(t *testing.T, repo *fakeRepo, id, spaceID, projectID string) *domain.Task {
	t.Helper()
	return seedTaskWithParent(t, repo, id, spaceID, projectID, "")
}

func seedTaskWithParent(t *testing.T, repo *fakeRepo, id, spaceID, projectID, parentID string) *domain.Task {
	t.Helper()

	var projectPtr, parentPtr *string
	if projectID != "" {
		projectPtr = &projectID
	}
	if parentID != "" {
		parentPtr = &parentID
	}

	task, err := domain.NewTask(domain.NewTaskParams{
		ID:        id,
		UserID:    "u1",
		SpaceID:   spaceID,
		ProjectID: projectPtr,
		ParentID:  parentPtr,
		Title:     "种子任务",
		Status:    domain.StatusInbox,
		Priority:  domain.PriorityNone,
		Now:       testNow,
	})
	if err != nil {
		t.Fatalf("seed task: %v", err)
	}
	repo.tasks[id] = task
	return task
}
