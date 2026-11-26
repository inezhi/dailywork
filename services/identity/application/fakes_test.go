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
	err error
}

// 返回带前缀的固定哈希
func (f fakeHasher) Hash(password string) (string, error) {
	if f.err != nil {
		return "", f.err
	}
	return "hashed:" + password, nil
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
