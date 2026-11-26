// Package domain 持有任务领域模型与规则，只依赖标准库。
package domain

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

// 领域错误。调用方用 errors.Is 判断；不要靠错误字符串匹配。
var (
	ErrSpaceRequired   = errors.New("domain: space is required")
	ErrTitleRequired   = errors.New("domain: title is required")
	ErrTitleTooLong    = errors.New("domain: title exceeds 200 characters")
	ErrNotesTooLong    = errors.New("domain: notes exceed 20000 characters")
	ErrEstimateRange   = errors.New("domain: estimate minutes must be between 0 and 10000")
	ErrDoneOnCreate    = errors.New("domain: cannot create a task as done")
	ErrInvalidStatus   = errors.New("domain: invalid status")
	ErrInvalidPriority = errors.New("domain: invalid priority")
	ErrAlreadyDone     = errors.New("domain: task is already done")
	ErrNotDone         = errors.New("domain: task is not done")
	ErrTaskNotFound    = errors.New("domain: task not found")
	ErrVersionConflict = errors.New("domain: version conflict")
)

// Status 是任务状态，值 1–6 与数据库、Thrift 枚举一致；领域内自定义，不复用生成代码。
type Status int

const (
	StatusInbox   Status = 1
	StatusNext    Status = 2
	StatusDoing   Status = 3
	StatusWaiting Status = 4
	StatusBlocked Status = 5
	StatusDone    Status = 6
)

// String 返回状态名，用于日志和协议转换。
func (s Status) String() string {
	switch s {
	case StatusInbox:
		return "inbox"
	case StatusNext:
		return "next"
	case StatusDoing:
		return "doing"
	case StatusWaiting:
		return "waiting"
	case StatusBlocked:
		return "blocked"
	case StatusDone:
		return "done"
	}
	return "unknown"
}

// valid 判断状态是否在合法范围内。
func (s Status) valid() bool { return s >= StatusInbox && s <= StatusDone }

// Priority 是任务优先级。1=none 2=low 3=medium 4=high 5=urgent。
type Priority int

const (
	PriorityNone   Priority = 1
	PriorityLow    Priority = 2
	PriorityMedium Priority = 3
	PriorityHigh   Priority = 4
	PriorityUrgent Priority = 5
)

// String 返回优先级名。
func (p Priority) String() string {
	switch p {
	case PriorityNone:
		return "none"
	case PriorityLow:
		return "low"
	case PriorityMedium:
		return "medium"
	case PriorityHigh:
		return "high"
	case PriorityUrgent:
		return "urgent"
	}
	return "unknown"
}

// valid 判断优先级是否在合法范围内。
func (p Priority) valid() bool { return p >= PriorityNone && p <= PriorityUrgent }

// Title 是任务标题，只能通过 NewTitle 构造，构造出来就是合法的。
type Title string

// NewTitle 去掉首尾空白后校验：非空、不超过 200 个字符（按字符不按字节）。
func NewTitle(s string) (Title, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return "", ErrTitleRequired
	}
	if utf8.RuneCountInString(s) > 200 {
		return "", ErrTitleTooLong
	}
	return Title(s), nil
}

// String 返回裸字符串。
func (t Title) String() string { return string(t) }

// Task 是聚合根；字段不导出，不变量只能通过领域方法改变。
// 不持有子任务：子任务是另一个聚合，只通过 parentID 关联。
type Task struct {
	id        string
	userID    string
	spaceID   string
	projectID *string
	parentID  *string
	title     Title
	notes     string
	status    Status
	priority  Priority

	scheduledDate   *time.Time
	dueDate         *time.Time
	estimateMinutes *int
	actualMinutes   int

	completedAt *time.Time
	version     int
	createdAt   time.Time
	updatedAt   time.Time
}

// NewTaskParams 是创建任务的入参；用具名结构体避免位置参数传反。
type NewTaskParams struct {
	ID              string
	UserID          string
	SpaceID         string
	ProjectID       *string
	ParentID        *string
	Title           string
	Notes           string
	Status          Status
	Priority        Priority
	ScheduledDate   *time.Time
	DueDate         *time.Time
	EstimateMinutes *int
	Now             time.Time
}

// NewTask 是创建任务的工厂，负责创建时的不变量，包括禁止创建即 done。
// 从数据库重建不走这里，见 Reconstitute。
func NewTask(p NewTaskParams) (*Task, error) {
	if strings.TrimSpace(p.SpaceID) == "" {
		return nil, ErrSpaceRequired
	}

	title, err := NewTitle(p.Title)
	if err != nil {
		return nil, err
	}
	if utf8.RuneCountInString(p.Notes) > 20000 {
		return nil, ErrNotesTooLong
	}

	if p.EstimateMinutes != nil && (*p.EstimateMinutes < 0 || *p.EstimateMinutes > 10000) {
		return nil, ErrEstimateRange
	}

	if !p.Status.valid() {
		return nil, ErrInvalidStatus
	}
	if p.Status == StatusDone {
		return nil, ErrDoneOnCreate
	}
	if !p.Priority.valid() {
		return nil, ErrInvalidPriority
	}

	return &Task{
		id:              p.ID,
		userID:          p.UserID,
		spaceID:         p.SpaceID,
		projectID:       p.ProjectID,
		parentID:        p.ParentID,
		title:           title,
		notes:           p.Notes,
		status:          p.Status,
		priority:        p.Priority,
		scheduledDate:   p.ScheduledDate,
		dueDate:         p.DueDate,
		estimateMinutes: p.EstimateMinutes,
		actualMinutes:   0,
		completedAt:     nil,
		version:         1,
		createdAt:       p.Now,
		updatedAt:       p.Now,
	}, nil
}

// Reconstitute 从持久化数据重建任务，不重放创建规则（数据当初就是合法的）。
func Reconstitute(
	id, userID, spaceID string,
	projectID, parentID *string,
	title, notes string,
	status Status,
	priority Priority,
	scheduledDate, dueDate *time.Time,
	estimateMinutes *int,
	actualMinutes int,
	completedAt *time.Time,
	version int,
	createdAt, updatedAt time.Time,
) *Task {
	return &Task{
		id: id, userID: userID, spaceID: spaceID,
		projectID: projectID, parentID: parentID,
		title: Title(title), notes: notes,
		status: status, priority: priority,
		scheduledDate: scheduledDate, dueDate: dueDate,
		estimateMinutes: estimateMinutes, actualMinutes: actualMinutes,
		completedAt: completedAt, version: version,
		createdAt: createdAt, updatedAt: updatedAt,
	}
}

// —— 行为 ——

// Complete 标记完成并写入完成时间，两者必须一起变；数据库 CHECK 只是兜底。
// 已完成再调用返回 ErrAlreadyDone，调用方可当作"目标已达成"。
func (t *Task) Complete(now time.Time) error {
	if t.status == StatusDone {
		return ErrAlreadyDone
	}
	t.status = StatusDone
	t.completedAt = &now
	t.updatedAt = now
	return nil
}

// Reopen 把已完成的任务重新打开：切到指定的非 done 状态，并清空完成时间。
func (t *Task) Reopen(to Status, now time.Time) error {
	if t.status != StatusDone {
		return ErrNotDone
	}
	if !to.valid() || to == StatusDone {
		return ErrInvalidStatus
	}
	t.status = to
	t.completedAt = nil
	t.updatedAt = now
	return nil
}

// —— 只读访问 ——

func (t *Task) ID() string                { return t.id }
func (t *Task) UserID() string            { return t.userID }
func (t *Task) SpaceID() string           { return t.spaceID }
func (t *Task) ProjectID() *string        { return t.projectID }
func (t *Task) ParentID() *string         { return t.parentID }
func (t *Task) Title() Title              { return t.title }
func (t *Task) Notes() string             { return t.notes }
func (t *Task) Status() Status            { return t.status }
func (t *Task) Priority() Priority        { return t.priority }
func (t *Task) ScheduledDate() *time.Time { return t.scheduledDate }
func (t *Task) DueDate() *time.Time       { return t.dueDate }
func (t *Task) EstimateMinutes() *int     { return t.estimateMinutes }
func (t *Task) ActualMinutes() int        { return t.actualMinutes }
func (t *Task) CompletedAt() *time.Time   { return t.completedAt }
func (t *Task) Version() int              { return t.version }

// 持久化成功后同步版本号，由仓储调用
func (t *Task) SyncVersion(version int) {
	t.version = version
}
func (t *Task) CreatedAt() time.Time { return t.createdAt }
func (t *Task) UpdatedAt() time.Time { return t.updatedAt }
