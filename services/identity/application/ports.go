// 声明 application 需要外界提供什么，全是接口，没有实现
package application

import (
	"context"
	"errors"
	"time"

	"github.com/inezhi/dailywork/services/identity/domain"
)

var (
	// 邮箱与手机号都没传
	ErrIdentifierMissing = errors.New("application: email or phone is required")
	// 邮箱与手机号同时传了
	ErrIdentifierBoth = errors.New("application: only one of email or phone is allowed")
	// 验证码不存在或不匹配
	ErrCodeInvalid = errors.New("application: invalid verification code")
	// 邮箱已注册
	ErrEmailTaken = errors.New("application: email already registered")
	// 手机号已注册
	ErrPhoneTaken = errors.New("application: phone already registered")
	// 密码少于 8 位
	ErrPasswordTooShort = errors.New("application: password must be at least 8 characters")
	// 密码超过 bcrypt 的 72 字节上限
	ErrPasswordTooLong = errors.New("application: password must be at most 72 bytes")
)

// 用户持久化
type UserRepository interface {
	Save(ctx context.Context, user *domain.User) error // 把新用户写进数据库

	// 注册前查重
	ExistsByEmail(ctx context.Context, email string) (bool, error)
	ExistsByPhone(ctx context.Context, phone string) (bool, error)
}

// 存验证码；Take 取出后立即删除
type VerificationCodeStore interface {
	Save(ctx context.Context, key string, code string, ttl time.Duration) error // 发验证码时写入redis
	Take(ctx context.Context, key string) (string, bool, error)                 // 注册时取出并删除
}

// 生成密码哈希
type PasswordHasher interface {
	Hash(password string) (string, error)
}

// 生成用户id
type IDGenerator interface {
	NewID() string
}

// 提供当前时间
type Clock interface {
	Now() time.Time
}
