// 会话校验用例
package application

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// 校验结果
type SessionIdentity struct {
	UserID    string
	SessionID string
	ExpiresAt time.Time
}

// ValidateSession 校验 token 和会话状态
type ValidateSession struct {
	sessions SessionRepository
	tokens   TokenManager
	clock    Clock
}

// 注入依赖
func NewValidateSession(sessions SessionRepository, tokens TokenManager, clock Clock) *ValidateSession {
	return &ValidateSession{sessions: sessions, tokens: tokens, clock: clock}
}

// 校验 token，返回会话信息
func (uc *ValidateSession) Execute(ctx context.Context, token string) (*SessionIdentity, error) {
	claims, err := uc.tokens.Verify(token)
	if err != nil {
		return nil, ErrTokenInvalid
	}

	session, err := uc.sessions.FindByID(ctx, claims.SessionID)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			return nil, ErrTokenInvalid
		}
		return nil, fmt.Errorf("find session: %w", err)
	}

	if !session.IsActive(uc.clock.Now()) {
		return nil, ErrTokenInvalid
	}
	if session.UserID() != claims.UserID {
		return nil, ErrTokenInvalid
	}

	return &SessionIdentity{
		UserID:    session.UserID(),
		SessionID: session.ID(),
		ExpiresAt: session.ExpiresAt(),
	}, nil
}
