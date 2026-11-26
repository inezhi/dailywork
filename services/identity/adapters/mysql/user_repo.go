// 对user表做什么
package mysql

import (
	"context"
	"errors"
	"fmt"
	"strings"

	mysqlDriver "github.com/go-sql-driver/mysql"
	"gorm.io/gorm"

	identityapp "github.com/inezhi/dailywork/services/identity/application"
	"github.com/inezhi/dailywork/services/identity/domain"
)

// 用户仓储
type UserRepo struct {
	db *gorm.DB
}

// 用已有连接造仓储
func NewUserRepo(db *gorm.DB) *UserRepo {
	return &UserRepo{db: db}
}

// 插入用户；唯一键冲突翻译成已注册错误
func (r *UserRepo) Save(ctx context.Context, user *domain.User) error {
	err := r.db.WithContext(ctx).Create(toUserRow(user)).Error
	if err != nil {
		return translateDuplicate(err)
	}
	return nil
}

// 邮箱是否已注册
func (r *UserRepo) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&userRow{}).
		Where("email = ?", email).
		Count(&count).Error
	if err != nil {
		return false, fmt.Errorf("count users by email: %w", err)
	}
	return count > 0, nil
}

// 手机号是否已注册
func (r *UserRepo) ExistsByPhone(ctx context.Context, phone string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&userRow{}).
		Where("phone = ?", phone).
		Count(&count).Error
	if err != nil {
		return false, fmt.Errorf("count users by phone: %w", err)
	}
	return count > 0, nil
}

// 把 MySQL 1062 唯一键冲突翻译成业务错误
func translateDuplicate(err error) error {
	var mysqlErr *mysqlDriver.MySQLError
	if !errors.As(err, &mysqlErr) || mysqlErr.Number != 1062 {
		return fmt.Errorf("insert user: %w", err)
	}

	switch {
	case strings.Contains(mysqlErr.Message, "users_email_uq"):
		return identityapp.ErrEmailTaken
	case strings.Contains(mysqlErr.Message, "users_phone_uq"):
		return identityapp.ErrPhoneTaken
	default:
		return fmt.Errorf("insert user: %w", err)
	}
}

// 把领域对象转成数据库行
func toUserRow(user *domain.User) *userRow {
	row := &userRow{
		ID:              user.ID(),
		PasswordHash:    user.PasswordHash(),
		MembershipLevel: user.MembershipLevel(),
		CreatedAt:       user.CreatedAt(),
		UpdatedAt:       user.UpdatedAt(),
	}

	if user.Email() != nil {
		value := user.Email().String()
		row.Email = &value
	}
	if user.Phone() != nil {
		value := user.Phone().String()
		row.Phone = &value
	}
	if user.AvatarURL() != "" {
		value := user.AvatarURL()
		row.AvatarURL = &value
	}

	return row
}
