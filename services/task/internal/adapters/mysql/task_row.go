package mysql

import "time"

// taskRow 对应 tasks 表的一行；字段和列名一一对应，不做业务判断。
type taskRow struct {
	ID              string     `gorm:"column:id;primaryKey"`
	UserID          string     `gorm:"column:user_id"`
	SpaceID         string     `gorm:"column:space_id"`
	ProjectID       *string    `gorm:"column:project_id"`
	ParentID        *string    `gorm:"column:parent_id"`
	Title           string     `gorm:"column:title"`
	Notes           string     `gorm:"column:notes"`
	Status          int8       `gorm:"column:status"`
	Priority        int8       `gorm:"column:priority"`
	ScheduledDate   *time.Time `gorm:"column:scheduled_date"`
	DueDate         *time.Time `gorm:"column:due_date"`
	EstimateMinutes *int       `gorm:"column:estimate_minutes"`
	ActualMinutes   int        `gorm:"column:actual_minutes"`
	SortOrder       int64      `gorm:"column:sort_order"`
	Version         int        `gorm:"column:version"`
	CompletedAt     *time.Time `gorm:"column:completed_at"`
	DeletedAt       *time.Time `gorm:"column:deleted_at"`
	CreatedAt       time.Time  `gorm:"column:created_at;autoCreateTime:false"`
	UpdatedAt       time.Time  `gorm:"column:updated_at;autoUpdateTime:false"`
}

// TableName 指定结构体对应的表名。
func (taskRow) TableName() string { return "tasks" }
