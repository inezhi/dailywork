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
	// 用户不存在
	ErrUserNotFound = errors.New("application: user not found")
	// 会话不存在
	ErrSessionNotFound = errors.New("application: session not found")
	// 邮箱、手机号或密码不对
	ErrInvalidCredentials = errors.New("application: invalid credentials")
	// token 无效、过期或对应会话已失效
	ErrTokenInvalid = errors.New("application: invalid token")
)

// 用户持久化
type UserRepository interface {
	Save(ctx context.Context, user *domain.User) error // 把新用户写进数据库

	// 注册前查重
	ExistsByEmail(ctx context.Context, email string) (bool, error)
	ExistsByPhone(ctx context.Context, phone string) (bool, error)

	// 登录时按标识查用户
	FindByEmail(ctx context.Context, email string) (*domain.User, error)
	FindByPhone(ctx context.Context, phone string) (*domain.User, error)
}

// 会话持久化
type SessionRepository interface {
	Save(ctx context.Context, session *domain.Session) error // 登录时新建会话
	FindByID(ctx context.Context, id string) (*domain.Session, error)
	Revoke(ctx context.Context, id string, now time.Time) error // 登出时吊销
}

// 签发与校验 JWT
type TokenManager interface {
	Sign(userID string, sessionID string, expiresAt time.Time) (string, error)
	Verify(token string) (TokenClaims, error)
}

// token 里携带的信息
type TokenClaims struct {
	UserID    string
	SessionID string
	ExpiresAt time.Time
}

// 存验证码；Take 取出后立即删除
type VerificationCodeStore interface {
	Save(ctx context.Context, key string, code string, ttl time.Duration) error // 发验证码时写入redis
	Take(ctx context.Context, key string) (string, bool, error)                 // 注册时取出并删除
}

// 生成密码哈希
type PasswordHasher interface {
	Hash(password string) (string, error)
	// 校验密码与哈希是否匹配
	Verify(password string, hash string) error
}

// 生成用户id
type IDGenerator interface {
	NewID() string
}

// 提供当前时间
type Clock interface {
	Now() time.Time
}
