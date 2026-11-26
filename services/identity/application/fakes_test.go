// 用例测试用的假实现
package application

import (
	"context"
	"time"

	"github.com/inezhi/dailywork/services/identity/domain"
)

// 内存用户仓储
type fakeUserRepo struct {
	saved       *domain.User
	emailExists bool
	phoneExists bool
	saveErr     error
	byEmail     *domain.User
	byPhone     *domain.User
	findErr     error
}

// 记录保存的用户
func (f *fakeUserRepo) Save(ctx context.Context, user *domain.User) error {
	if f.saveErr != nil {
		return f.saveErr
	}
	f.saved = user
	return nil
}

// 返回预设的邮箱是否存在
func (f *fakeUserRepo) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	return f.emailExists, nil
}

// 返回预设的手机号是否存在
func (f *fakeUserRepo) ExistsByPhone(ctx context.Context, phone string) (bool, error) {
	return f.phoneExists, nil
}

// 返回预设的邮箱用户
func (f *fakeUserRepo) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	if f.findErr != nil {
		return nil, f.findErr
	}
	if f.byEmail == nil {
		return nil, ErrUserNotFound
	}
	return f.byEmail, nil
}

// 返回预设的手机号用户
func (f *fakeUserRepo) FindByPhone(ctx context.Context, phone string) (*domain.User, error) {
	if f.findErr != nil {
		return nil, f.findErr
	}
	if f.byPhone == nil {
		return nil, ErrUserNotFound
	}
	return f.byPhone, nil
}

// 内存验证码存储
type fakeCodeStore struct {
	code      string
	found     bool
	savedKey  string
	savedCode string
	savedTTL  time.Duration
	saveErr   error
	takeErr   error
}

// 记录保存的 key、code 和 TTL
func (f *fakeCodeStore) Save(ctx context.Context, key string, code string, ttl time.Duration) error {
	if f.saveErr != nil {
		return f.saveErr
	}
	f.savedKey = key
	f.savedCode = code
	f.savedTTL = ttl
	return nil
}

// 返回预设的验证码
func (f *fakeCodeStore) Take(ctx context.Context, key string) (string, bool, error) {
	if f.takeErr != nil {
		return "", false, f.takeErr
	}
	return f.code, f.found, nil
}

// 固定哈希的密码哈希器
type fakeHasher struct {
	err       error
	verifyErr error
}

// 返回带前缀的固定哈希
func (f fakeHasher) Hash(password string) (string, error) {
	if f.err != nil {
		return "", f.err
	}
	return "hashed:" + password, nil
}

// 返回预设的校验结果
func (f fakeHasher) Verify(password string, hash string) error {
	return f.verifyErr
}

// 固定 id 生成器
type fakeIDs struct {
	id string
}

// 返回固定 id
func (f fakeIDs) NewID() string {
	return f.id
}

// 固定时钟
type fakeClock struct {
	now time.Time
}

// 返回固定时间
func (f fakeClock) Now() time.Time {
	return f.now
}

// 内存会话仓储
type fakeSessionRepo struct {
	saved     *domain.Session
	session   *domain.Session
	saveErr   error
	findErr   error
	revokedID string
	revokeErr error
}

// 记录保存的会话
func (f *fakeSessionRepo) Save(ctx context.Context, session *domain.Session) error {
	if f.saveErr != nil {
		return f.saveErr
	}
	f.saved = session
	return nil
}

// 返回预设会话
func (f *fakeSessionRepo) FindByID(ctx context.Context, id string) (*domain.Session, error) {
	if f.findErr != nil {
		return nil, f.findErr
	}
	if f.session == nil {
		return nil, ErrSessionNotFound
	}
	return f.session, nil
}

// 记录被吊销的会话
func (f *fakeSessionRepo) Revoke(ctx context.Context, id string, now time.Time) error {
	if f.revokeErr != nil {
		return f.revokeErr
	}
	f.revokedID = id
	return nil
}

// 固定 token 管理器
type fakeTokens struct {
	signToken string
	signErr   error
	claims    TokenClaims
	verifyErr error
}

// 返回固定 token
func (f fakeTokens) Sign(userID string, sessionID string, expiresAt time.Time) (string, error) {
	if f.signErr != nil {
		return "", f.signErr
	}
	return f.signToken, nil
}

// 返回预设声明
func (f fakeTokens) Verify(token string) (TokenClaims, error) {
	if f.verifyErr != nil {
		return TokenClaims{}, f.verifyErr
	}
	return f.claims, nil
}
