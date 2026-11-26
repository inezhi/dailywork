// “注册” 这个操作的完整流程，不写规则、不碰数据库，只负责按顺序把事情串起来。
package application

import (
	"context"
	"fmt"

	"github.com/inezhi/dailywork/services/identity/domain"
)

// 密码长度边界，上限来自 bcrypt
const (
	minPasswordLength = 8
	maxPasswordLength = 72
)

// 注册入参
type RegisterInput struct {
	Email    *string
	Phone    *string
	Code     string
	Password string
}

// Register 完成注册：验证码、查重、哈希、保存
type Register struct {
	users  UserRepository
	codes  VerificationCodeStore
	hasher PasswordHasher
	ids    IDGenerator
	clock  Clock
}

// 注入依赖
func NewRegister(users UserRepository, codes VerificationCodeStore, hasher PasswordHasher, ids IDGenerator, clock Clock) *Register {
	return &Register{users: users, codes: codes, hasher: hasher, ids: ids, clock: clock}
}

// 按步骤完成注册
func (uc *Register) Execute(ctx context.Context, in RegisterInput) (*domain.User, error) {
	id, err := parseIdentifier(in.Email, in.Phone)
	if err != nil {
		return nil, err
	}

	err = validatePassword(in.Password)
	if err != nil {
		return nil, err
	}

	err = uc.consumeCode(ctx, id.key, in.Code)
	if err != nil {
		return nil, err
	}

	err = uc.checkNotTaken(ctx, id)
	if err != nil {
		return nil, err
	}

	hash, err := uc.hasher.Hash(in.Password)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	user, err := uc.newUser(id, hash)
	if err != nil {
		return nil, err
	}

	err = uc.users.Save(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("save user: %w", err)
	}
	return user, nil
}

// 从存储取出验证码并比对，取完即删
func (uc *Register) consumeCode(ctx context.Context, key string, code string) error {
	stored, found, err := uc.codes.Take(ctx, key)
	if err != nil {
		return fmt.Errorf("take code: %w", err)
	}
	if !found || stored != code {
		return ErrCodeInvalid
	}
	return nil
}

// 邮箱或手机号已被注册则报错
func (uc *Register) checkNotTaken(ctx context.Context, id identifier) error {
	if id.email != nil {
		exists, err := uc.users.ExistsByEmail(ctx, id.email.String())
		if err != nil {
			return fmt.Errorf("check email: %w", err)
		}
		if exists {
			return ErrEmailTaken
		}
		return nil
	}

	exists, err := uc.users.ExistsByPhone(ctx, id.phone.String())
	if err != nil {
		return fmt.Errorf("check phone: %w", err)
	}
	if exists {
		return ErrPhoneTaken
	}
	return nil
}

// 构造用户聚合
func (uc *Register) newUser(id identifier, hash string) (*domain.User, error) {
	return domain.NewUser(domain.NewUserParams{
		ID:           uc.ids.NewID(),
		Email:        id.email,
		Phone:        id.phone,
		PasswordHash: hash,
		Now:          uc.clock.Now(),
	})
}

// 密码长度必须在 8 到 72 字节之间
func validatePassword(password string) error {
	if len(password) < minPasswordLength {
		return ErrPasswordTooShort
	}
	if len(password) > maxPasswordLength {
		return ErrPasswordTooLong
	}
	return nil
}
