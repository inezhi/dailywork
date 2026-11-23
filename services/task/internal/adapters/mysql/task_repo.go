// Package mysql 是任务仓储的 MySQL 实现；它只做「行 ↔ 领域对象」的转换，不写业务规则。
package mysql

import (
	"context"
	"errors"
	"fmt"

	gormmysql "gorm.io/driver/mysql"
	"gorm.io/gorm"

	"github.com/inezhi/dailywork/services/task/internal/domain"
)

// TaskRepo 实现 domain.TaskRepository。
type TaskRepo struct {
	db *gorm.DB
}

// New 用已有连接造一个仓储：造一个仓储对象，把数据库连接塞进去，返回它的指针。
func New(db *gorm.DB) *TaskRepo { return &TaskRepo{db: db} }

// Open 连库并返回 *gorm.DB，供 main.go 使用。
func Open(dsn string) (*gorm.DB, error) {
	db, err := gorm.Open(gormmysql.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("open mysql: %w", err)
	}
	return db, nil
}

// Save 先按乐观锁更新；没改到行时，再判断是「不存在」还是「版本冲突」。
func (r *TaskRepo) Save(ctx context.Context, t *domain.Task) error {
	res := r.db.WithContext(ctx).Model(&taskRow{}).
		Where("id = ? AND version = ?", t.ID(), t.Version()).
		Updates(mutableColumns(t))
	if res.Error != nil {
		return fmt.Errorf("update task: %w", res.Error)
	}

	// 改到了：更新成功
	if res.RowsAffected > 0 {
		return nil
	}

	// 没改到，要区分「这行不存在」还是「版本对不上」
	var count int64
	if err := r.db.WithContext(ctx).Model(&taskRow{}).Where("id = ?", t.ID()).Count(&count).Error; err != nil {
		return fmt.Errorf("count task: %w", err)
	}
	// 行存在但没改到：别人先改过，版本冲突
	if count > 0 {
		return domain.ErrVersionConflict
	}

	// 行不存在：新任务，插入
	if err := r.db.WithContext(ctx).Create(toRow(t)).Error; err != nil {
		return fmt.Errorf("insert task: %w", err)
	}
	return nil
}

// FindByID 按 id 查未删除的任务；查不到返回 ErrTaskNotFound。
func (r *TaskRepo) FindByID(ctx context.Context, id string) (*domain.Task, error) {
	var row taskRow
	err := r.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).Take(&row).Error
	// GORM 的「没查到」翻译成领域错误，上层不用认识 GORM
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, domain.ErrTaskNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("find task: %w", err)
	}
	return toDomain(&row), nil
}

// toRow 把领域对象转成数据库行。
func toRow(t *domain.Task) *taskRow {
	return &taskRow{
		ID:              t.ID(),
		UserID:          t.UserID(),
		SpaceID:         t.SpaceID(),
		ProjectID:       t.ProjectID(),
		ParentID:        t.ParentID(),
		Title:           t.Title().String(),
		Notes:           t.Notes(),
		Status:          int8(t.Status()),
		Priority:        int8(t.Priority()),
		ScheduledDate:   t.ScheduledDate(),
		DueDate:         t.DueDate(),
		EstimateMinutes: t.EstimateMinutes(),
		ActualMinutes:   t.ActualMinutes(),
		Version:         t.Version(),
		CompletedAt:     t.CompletedAt(),
		CreatedAt:       t.CreatedAt(),
		UpdatedAt:       t.UpdatedAt(),
	}
}

// mutableColumns 是更新时允许改动的列；version 每次 +1。
func mutableColumns(t *domain.Task) map[string]any {
	return map[string]any{
		"title":            t.Title().String(),
		"notes":            t.Notes(),
		"status":           int8(t.Status()),
		"priority":         int8(t.Priority()),
		"project_id":       t.ProjectID(),
		"parent_id":        t.ParentID(),
		"scheduled_date":   t.ScheduledDate(),
		"due_date":         t.DueDate(),
		"estimate_minutes": t.EstimateMinutes(),
		"actual_minutes":   t.ActualMinutes(),
		"completed_at":     t.CompletedAt(),
		"version":          t.Version() + 1,
		"updated_at":       t.UpdatedAt(),
	}
}

// toDomain 把数据库行还原成领域对象，走 Reconstitute 不重放校验。
func toDomain(r *taskRow) *domain.Task {
	return domain.Reconstitute(
		r.ID, r.UserID, r.SpaceID,
		r.ProjectID, r.ParentID,
		r.Title, r.Notes,
		domain.Status(r.Status), domain.Priority(r.Priority),
		r.ScheduledDate, r.DueDate,
		r.EstimateMinutes, r.ActualMinutes,
		r.CompletedAt, r.Version,
		r.CreatedAt, r.UpdatedAt,
	)
}
