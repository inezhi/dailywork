// 任务领域的领域事件
package domain

import "time"

// TaskCompleted 是任务完成时产生的事实
type TaskCompleted struct {
	TaskID      string    `json:"taskId"`
	UserID      string    `json:"userId"`
	SpaceID     string    `json:"spaceId"`
	Title       string    `json:"title"`
	CompletedAt time.Time `json:"completedAt"`
}
