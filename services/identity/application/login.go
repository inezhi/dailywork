// 登录用例
package application

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/inezhi/dailywork/services/identity/domain"
)

// 会话有效期
const sessionTTL = 30 * 24 * time.Hour

// 登录入参
type LoginInput struct {
	Email    *string
	Phone    *string
	Password string
	Client   string
	Device   string
	IP       string
}

// 登录结果
type LoginResult struct {
	Token     string
	UserID    string
	ExpiresAt time.Time
}

// Login 校验密码、建会话、签 JWT
type Login struct {
	users    UserRepository
	sessions SessionRepository
	hasher   PasswordHasher
	tokens   TokenManager
	ids      IDGenerator
	clock    Clock
}

// 注入依赖
func NewLogin(
	users UserRepository,
	sessions SessionRepository,
	hasher PasswordHasher,
	tokens TokenManager,
	ids IDGenerator,
	clock Clock,
) *Login {
	return &Login{users: users, sessions: sessions, hasher: hasher, tokens: tokens, ids: ids, clock: clock}
}

// 按步骤完成登录
func (uc *Login) Execute(ctx context.Context, in LoginInput) (*LoginResult, error) {
	id, err := parseIdentifier(in.Email, in.Phone)
	if err != nil {
		return nil, err
	}

	user, err := uc.findUser(ctx, id)
	if err != nil {
		return nil, err
	}

	err = uc.hasher.Verify(in.Password, user.PasswordHash())
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	session, err := uc.newSession(user, in)
	if err != nil {
		return nil, err
	}

	err = uc.sessions.Save(ctx, session)
	if err != nil {
		return nil, fmt.Errorf("save session: %w", err)
	}

	token, err := uc.tokens.Sign(user.ID(), session.ID(), session.ExpiresAt())
	if err != nil {
		return nil, fmt.Errorf("sign token: %w", err)
	}

	return &LoginResult{
		Token:     token,
		UserID:    user.ID(),
		ExpiresAt: session.ExpiresAt(),
	}, nil
}

// 按标识查用户；查不到也说凭据不对，避免泄露账号是否存在
func (uc *Login) findUser(ctx context.Context, id identifier) (*domain.User, error) {
	var (
		user *domain.User
		err  error
	)
	if id.email != nil {
		user, err = uc.users.FindByEmail(ctx, id.email.String())
	} else {
		user, err = uc.users.FindByPhone(ctx, id.phone.String())
	}

	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("find user: %w", err)
	}
	return user, nil
}

// 构造会话；client 空值按 web 处理
func (uc *Login) newSession(user *domain.User, in LoginInput) (*domain.Session, error) {
	now := uc.clock.Now()
	client := in.Client
	if client == "" {
		client = "web"
	}

	return domain.NewSession(domain.NewSessionParams{
		ID:        uc.ids.NewID(),
		UserID:    user.ID(),
		Client:    client,
		Device:    in.Device,
		IP:        in.IP,
		ExpiresAt: now.Add(sessionTTL),
		Now:       now,
	})
}
