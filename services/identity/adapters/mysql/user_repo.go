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

// 按邮箱查用户
func (r *UserRepo) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	var row userRow
	err := r.db.WithContext(ctx).Where("email = ?", email).Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, identityapp.ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("find user by email: %w", err)
	}
	return toUserDomain(&row)
}

// 按手机号查用户
func (r *UserRepo) FindByPhone(ctx context.Context, phone string) (*domain.User, error) {
	var row userRow
	err := r.db.WithContext(ctx).Where("phone = ?", phone).Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, identityapp.ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("find user by phone: %w", err)
	}
	return toUserDomain(&row)
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

// 把数据库行还原成领域对象
func toUserDomain(row *userRow) (*domain.User, error) {
	var email *domain.Email
	if row.Email != nil {
		parsed, err := domain.NewEmail(*row.Email)
		if err != nil {
			return nil, fmt.Errorf("parse stored email: %w", err)
		}
		email = &parsed
	}

	var phone *domain.Phone
	if row.Phone != nil {
		parsed, err := domain.NewPhone(*row.Phone)
		if err != nil {
			return nil, fmt.Errorf("parse stored phone: %w", err)
		}
		phone = &parsed
	}

	avatarURL := ""
	if row.AvatarURL != nil {
		avatarURL = *row.AvatarURL
	}

	return domain.Reconstitute(
		row.ID,
		email,
		phone,
		row.PasswordHash,
		avatarURL,
		row.MembershipLevel,
		row.CreatedAt,
		row.UpdatedAt,
	), nil
}
