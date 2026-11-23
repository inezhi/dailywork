package mysql

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/inezhi/dailywork/services/task/internal/domain"
)

// 集成测试：需要本地 MySQL。设置 TEST_MYSQL_DSN 才会跑，否则跳过。
func newTestRepo(t *testing.T) *TaskRepo {
	t.Helper()
	dsn := os.Getenv("TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("TEST_MYSQL_DSN 未设置，跳过集成测试")
	}
	db, err := Open(dsn)
	if err != nil {
		t.Fatalf("open mysql: %v", err)
	}
	return New(db)
}

func TestSaveAndFind(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()
	id := fmt.Sprintf("test-%d", time.Now().UnixNano())
	now := time.Now().UTC().Truncate(time.Millisecond)

	t.Cleanup(func() {
		repo.db.Exec("DELETE FROM tasks WHERE id = ?", id)
	})

	task, err := domain.NewTask(domain.NewTaskParams{
		ID:       id,
		UserID:   "u1",
		SpaceID:  "s1",
		Title:    "测试任务",
		Status:   domain.StatusInbox,
		Priority: domain.PriorityHigh,
		Now:      now,
	})
	if err != nil {
		t.Fatalf("new task: %v", err)
	}

	if err := repo.Save(ctx, task); err != nil {
		t.Fatalf("insert: %v", err)
	}

	got, err := repo.FindByID(ctx, id)
	if err != nil {
		t.Fatalf("find: %v", err)
	}
	if got.Title().String() != "测试任务" {
		t.Errorf("title = %q", got.Title())
	}
	if got.Status() != domain.StatusInbox {
		t.Errorf("status = %v", got.Status())
	}
	if got.Version() != 1 {
		t.Errorf("version = %d, want 1", got.Version())
	}
	if !got.CreatedAt().Equal(now) {
		t.Errorf("createdAt = %v, want %v", got.CreatedAt(), now)
	}
}

func TestUpdateAndVersionConflict(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()
	id := fmt.Sprintf("test-%d", time.Now().UnixNano())
	now := time.Now().UTC().Truncate(time.Millisecond)

	t.Cleanup(func() {
		repo.db.Exec("DELETE FROM tasks WHERE id = ?", id)
	})

	task, err := domain.NewTask(domain.NewTaskParams{
		ID: id, UserID: "u1", SpaceID: "s1",
		Title: "测试任务", Status: domain.StatusInbox, Priority: domain.PriorityNone,
		Now: now,
	})
	if err != nil {
		t.Fatalf("new task: %v", err)
	}
	if err := repo.Save(ctx, task); err != nil {
		t.Fatalf("insert: %v", err)
	}

	// 正常更新：完成后保存，版本 +1
	if err := task.Complete(now.Add(time.Minute)); err != nil {
		t.Fatalf("complete: %v", err)
	}
	if err := repo.Save(ctx, task); err != nil {
		t.Fatalf("update: %v", err)
	}

	got, _ := repo.FindByID(ctx, id)
	if got.Status() != domain.StatusDone {
		t.Errorf("status = %v, want done", got.Status())
	}
	if got.Version() != 2 {
		t.Errorf("version = %d, want 2", got.Version())
	}
	if got.CompletedAt() == nil {
		t.Error("completedAt should not be nil")
	}

	// 旧版本再保存：版本冲突
	if err := repo.Save(ctx, task); !errors.Is(err, domain.ErrVersionConflict) {
		t.Fatalf("err = %v, want ErrVersionConflict", err)
	}
}

func TestFindMissing(t *testing.T) {
	repo := newTestRepo(t)
	_, err := repo.FindByID(context.Background(), "no-such-id")
	if !errors.Is(err, domain.ErrTaskNotFound) {
		t.Fatalf("err = %v, want ErrTaskNotFound", err)
	}
}
