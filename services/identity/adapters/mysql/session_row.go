// sessions 表对应的结构体
package mysql

import "time"

type sessionRow struct {
	ID         string     `gorm:"column:id;primaryKey"`
	UserID     string     `gorm:"column:user_id"`
	Client     string     `gorm:"column:client"`
	Device     *string    `gorm:"column:device"`
	IP         *string    `gorm:"column:ip"`
	ExpiresAt  time.Time  `gorm:"column:expires_at;autoCreateTime:false"`
	RevokedAt  *time.Time `gorm:"column:revoked_at"`
	LastSeenAt *time.Time `gorm:"column:last_seen_at"`
	CreatedAt  time.Time  `gorm:"column:created_at;autoCreateTime:false"`
}

// 指定表名
func (sessionRow) TableName() string {
	return "sessions"
}
