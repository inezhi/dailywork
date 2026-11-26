// users 表对应的结构体
package mysql

import "time"

type userRow struct {
	ID              string    `gorm:"column:id;primaryKey"`
	Email           *string   `gorm:"column:email"`
	Phone           *string   `gorm:"column:phone"`
	PasswordHash    string    `gorm:"column:password_hash"`
	AvatarURL       *string   `gorm:"column:avatar_url"`
	MembershipLevel int       `gorm:"column:membership_level"`
	CreatedAt       time.Time `gorm:"column:created_at;autoCreateTime:false"`
	UpdatedAt       time.Time `gorm:"column:updated_at;autoUpdateTime:false"`
}

// 指定表名
func (userRow) TableName() string {
	return "users"
}
