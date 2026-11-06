// Package application 编排用例，只依赖 domain，不依赖数据库与 RPC。
package application

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/inezhi/dailywork/services/task/internal/domain"
)

// 三个接口定义在消费方；TaskRepository 只处理单个聚合根，没有批量方法。
type TaskRepository interface {
	Save(ctx context.Context, t *domain.Task) error
	FindByID(ctx context.Context, id string) (*domain.Task, error)
}

// IDGenerator 生成聚合根 ID。做成接口，测试时可以返回固定值。
type IDGenerator interface {
	NewID() string
}

// Clock 提供当前时间。同样是为了测试可控。
type Clock interface {
	Now() time.Time
}

var ErrParentIsSubtask = errors.New("application: parent task is already a subtask")

// CreateTaskInput 是用例入参，贴近协议；默认值由用例决定。
type CreateTaskInput struct {
	UserID    string
	SpaceID   string // 必填；省略时的"个人空间"由 gateway 从配置补上（切片 2 有了空间管理再改）
	ProjectID *string
	ParentID  *string

	Title    string
	Notes    string
	Status   domain.Status
	Priority domain.Priority

	ScheduledDate   *time.Time
	DueDate         *time.Time
	EstimateMinutes *int
}

// CreateTask 是创建任务的用例：处理跨聚合的继承、调领域工厂、保存。
// 不变量由 domain 守，这里只编排顺序。
type CreateTask struct {
	repo  TaskRepository
	ids   IDGenerator
	clock Clock
}

func NewCreateTask(repo TaskRepository, ids IDGenerator, clock Clock) *CreateTask {
	return &CreateTask{repo: repo, ids: ids, clock: clock}
}

func (uc *CreateTask) Execute(ctx context.Context, in CreateTaskInput) (*domain.Task, error) {
	// 1. 先按请求里的空间与项目来；如果带了父任务，下面会覆盖成父任务的。
	spaceID, projectID := in.SpaceID, in.ProjectID

	// 2. 跨聚合规则：子任务继承父任务的空间与项目，由应用层读父任务后复制。
	if in.ParentID != nil {
		parent, err := uc.repo.FindByID(ctx, *in.ParentID)
		if err != nil {
			return nil, fmt.Errorf("load parent task: %w", err)
		}
		// 父子只允许一层：父任务本身如果已经是子任务，就拒绝。
		if parent.ParentID() != nil {
			return nil, ErrParentIsSubtask
		}
		// 带 parentId 时忽略请求里的 spaceId 与 projectId，继承父任务。
		spaceID, projectID = parent.SpaceID(), parent.ProjectID()
	}

	// 3. 交给领域层构造，校验规则都在 domain.NewTask 里。
	task, err := domain.NewTask(domain.NewTaskParams{
		ID:              uc.ids.NewID(),
		UserID:          in.UserID,
		SpaceID:         spaceID,
		ProjectID:       projectID,
		ParentID:        in.ParentID,
		Title:           in.Title,
		Notes:           in.Notes,
		Status:          in.Status,
		Priority:        in.Priority,
		ScheduledDate:   in.ScheduledDate,
		DueDate:         in.DueDate,
		EstimateMinutes: in.EstimateMinutes,
		Now:             uc.clock.Now(),
	})
	if err != nil {
		// 领域校验失败原样返回，由 gateway 映射成 400。
		return nil, err
	}

	// 4. 落库；失败是基础设施问题，包一层说明出错的步骤。
	err = uc.repo.Save(ctx, task)
	if err != nil {
		return nil, fmt.Errorf("save task: %w", err)
	}
	return task, nil
}
