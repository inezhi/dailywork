package domain

import (
	"errors"
	"strings"
	"testing"
	"time"
)

var fixedNow = time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC)

func baseParams() NewTaskParams {
	return NewTaskParams{
		ID:       "t1",
		UserID:   "u1",
		SpaceID:  "s1",
		Title:    "写周报",
		Status:   StatusInbox,
		Priority: PriorityNone,
		Now:      fixedNow,
	}
}

func TestNewTaskDefaults(t *testing.T) {
	task, err := NewTask(baseParams())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if task.Version() != 1 {
		t.Errorf("version = %d, want 1", task.Version())
	}
	if task.CompletedAt() != nil {
		t.Errorf("completedAt = %v, want nil", task.CompletedAt())
	}
	if task.ActualMinutes() != 0 {
		t.Errorf("actualMinutes = %d, want 0", task.ActualMinutes())
	}
	if task.Status() != StatusInbox {
		t.Errorf("status = %v, want inbox", task.Status())
	}
}

func TestNewTaskValidation(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(*NewTaskParams)
		wantErr error
	}{
		{"空间为空", func(p *NewTaskParams) { p.SpaceID = "" }, ErrSpaceRequired},
		{"标题为空", func(p *NewTaskParams) { p.Title = "" }, ErrTitleRequired},
		{"标题只有空格", func(p *NewTaskParams) { p.Title = "   " }, ErrTitleRequired},
		{"标题超过 200 字符", func(p *NewTaskParams) { p.Title = strings.Repeat("写", 201) }, ErrTitleTooLong},
		{"备注超过 20000 字符", func(p *NewTaskParams) { p.Notes = strings.Repeat("字", 20001) }, ErrNotesTooLong},
		{"预估为负", func(p *NewTaskParams) { n := -1; p.EstimateMinutes = &n }, ErrEstimateRange},
		{"预估超过 10000", func(p *NewTaskParams) { n := 10001; p.EstimateMinutes = &n }, ErrEstimateRange},
		{"创建时状态为 done", func(p *NewTaskParams) { p.Status = StatusDone }, ErrDoneOnCreate},
		{"状态越界", func(p *NewTaskParams) { p.Status = Status(9) }, ErrInvalidStatus},
		{"优先级越界", func(p *NewTaskParams) { p.Priority = Priority(9) }, ErrInvalidPriority},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := baseParams()
			tt.mutate(&p)

			_, err := NewTask(p)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestNewTaskAcceptsBoundaryValues(t *testing.T) {
	p := baseParams()
	p.Title = strings.Repeat("写", 200) // 正好 200 个字符，按字符算不按字节
	n := 10000
	p.EstimateMinutes = &n

	if _, err := NewTask(p); err != nil {
		t.Fatalf("boundary values rejected: %v", err)
	}
}

func TestNewTaskTrimsTitle(t *testing.T) {
	p := baseParams()
	p.Title = "  写周报  "

	task, err := NewTask(p)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if task.Title() != "写周报" {
		t.Errorf("title = %q, want %q", task.Title(), "写周报")
	}
}

func TestComplete(t *testing.T) {
	task, err := NewTask(baseParams())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if err := task.Complete(fixedNow); err != nil {
		t.Fatalf("complete: %v", err)
	}

	if task.Status() != StatusDone {
		t.Errorf("status = %v, want done", task.Status())
	}
	if task.CompletedAt() == nil || !task.CompletedAt().Equal(fixedNow) {
		t.Errorf("completedAt = %v, want %v", task.CompletedAt(), fixedNow)
	}
	if !task.UpdatedAt().Equal(fixedNow) {
		t.Errorf("updatedAt = %v, want %v", task.UpdatedAt(), fixedNow)
	}

	// 不变量：done 与 completedAt 同时成立
	if (task.Status() == StatusDone) != (task.CompletedAt() != nil) {
		t.Error("invariant broken: status=done must imply completedAt != nil")
	}
}

func TestCompleteTwice(t *testing.T) {
	task, _ := NewTask(baseParams())
	if err := task.Complete(fixedNow); err != nil {
		t.Fatalf("first complete: %v", err)
	}

	later := fixedNow.Add(time.Hour)
	if err := task.Complete(later); !errors.Is(err, ErrAlreadyDone) {
		t.Fatalf("err = %v, want ErrAlreadyDone", err)
	}

	// 第二次调用不能改动完成时间
	if !task.CompletedAt().Equal(fixedNow) {
		t.Errorf("completedAt changed on second complete: %v", task.CompletedAt())
	}
}

func TestReopen(t *testing.T) {
	task, _ := NewTask(baseParams())
	if err := task.Complete(fixedNow); err != nil {
		t.Fatalf("complete: %v", err)
	}

	later := fixedNow.Add(time.Hour)
	if err := task.Reopen(StatusNext, later); err != nil {
		t.Fatalf("reopen: %v", err)
	}

	if task.Status() != StatusNext {
		t.Errorf("status = %v, want next", task.Status())
	}
	if task.CompletedAt() != nil {
		t.Errorf("completedAt = %v, want nil", task.CompletedAt())
	}
}

func TestReopenRequiresDone(t *testing.T) {
	task, _ := NewTask(baseParams())

	if err := task.Reopen(StatusNext, fixedNow); !errors.Is(err, ErrNotDone) {
		t.Fatalf("err = %v, want ErrNotDone", err)
	}
}

func TestReopenRejectsDoneAsTarget(t *testing.T) {
	task, _ := NewTask(baseParams())
	if err := task.Complete(fixedNow); err != nil {
		t.Fatalf("complete: %v", err)
	}

	if err := task.Reopen(StatusDone, fixedNow); !errors.Is(err, ErrInvalidStatus) {
		t.Fatalf("err = %v, want ErrInvalidStatus", err)
	}
}

func TestNewTitle(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    Title
		wantErr error
	}{
		{"正常标题", "写周报", "写周报", nil},
		{"去掉首尾空白", "  写周报  ", "写周报", nil},
		{"空字符串", "", "", ErrTitleRequired},
		{"只有空格", "   ", "", ErrTitleRequired},
		{"正好 200 字符", strings.Repeat("写", 200), Title(strings.Repeat("写", 200)), nil},
		{"超过 200 字符", strings.Repeat("写", 201), "", ErrTitleTooLong},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NewTitle(tt.input)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if err == nil && got != tt.want {
				t.Errorf("got %q, want %q", got, tt.want)
			}
		})
	}
}
