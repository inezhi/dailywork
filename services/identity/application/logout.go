// 登出用例
package application

import (
	"context"
	"fmt"
)

// Logout 吊销会话
type Logout struct {
	sessions SessionRepository
	clock    Clock
}

// 注入依赖
func NewLogout(sessions SessionRepository, clock Clock) *Logout {
	return &Logout{sessions: sessions, clock: clock}
}

// 按 session id 吊销会话
func (uc *Logout) Execute(ctx context.Context, sessionID string) error {
	err := uc.sessions.Revoke(ctx, sessionID, uc.clock.Now())
	if err != nil {
		return fmt.Errorf("revoke session: %w", err)
	}
	return nil
}
