// 会话校验用例测试
package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/inezhi/dailywork/services/identity/domain"
)

// 造一个有效会话
func activeSession(now time.Time) *domain.Session {
	return domain.ReconstituteSession(
		"sess-1", "user-1", "web", "", "",
		now.Add(time.Hour), nil, nil, now,
	)
}

func TestValidateSessionOK(t *testing.T) {
	now := time.Date(2026, 11, 24, 10, 0, 0, 0, time.UTC)
	sessions := &fakeSessionRepo{session: activeSession(now)}
	tokens := fakeTokens{claims: TokenClaims{UserID: "user-1", SessionID: "sess-1"}}
	uc := NewValidateSession(sessions, tokens, fakeClock{now: now})

	identity, err := uc.Execute(context.Background(), "token")
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if identity.UserID != "user-1" || identity.SessionID != "sess-1" {
		t.Errorf("identity = %+v", identity)
	}
}

func TestValidateSessionInvalidToken(t *testing.T) {
	uc := NewValidateSession(
		&fakeSessionRepo{},
		fakeTokens{verifyErr: ErrTokenInvalid},
		fakeClock{now: time.Now()},
	)

	_, err := uc.Execute(context.Background(), "bad")
	if !errors.Is(err, ErrTokenInvalid) {
		t.Errorf("err = %v", err)
	}
}

func TestValidateSessionNotFound(t *testing.T) {
	uc := NewValidateSession(
		&fakeSessionRepo{findErr: ErrSessionNotFound},
		fakeTokens{claims: TokenClaims{UserID: "user-1", SessionID: "sess-1"}},
		fakeClock{now: time.Now()},
	)

	_, err := uc.Execute(context.Background(), "token")
	if !errors.Is(err, ErrTokenInvalid) {
		t.Errorf("err = %v", err)
	}
}

func TestValidateSessionRevoked(t *testing.T) {
	now := time.Date(2026, 11, 24, 10, 0, 0, 0, time.UTC)
	revoked := now.Add(-time.Minute)
	session := domain.ReconstituteSession(
		"sess-1", "user-1", "web", "", "",
		now.Add(time.Hour), &revoked, nil, now,
	)
	uc := NewValidateSession(
		&fakeSessionRepo{session: session},
		fakeTokens{claims: TokenClaims{UserID: "user-1", SessionID: "sess-1"}},
		fakeClock{now: now},
	)

	_, err := uc.Execute(context.Background(), "token")
	if !errors.Is(err, ErrTokenInvalid) {
		t.Errorf("err = %v", err)
	}
}

func TestValidateSessionExpired(t *testing.T) {
	now := time.Date(2026, 11, 24, 10, 0, 0, 0, time.UTC)
	session := domain.ReconstituteSession(
		"sess-1", "user-1", "web", "", "",
		now.Add(-time.Minute), nil, nil, now.Add(-time.Hour),
	)
	uc := NewValidateSession(
		&fakeSessionRepo{session: session},
		fakeTokens{claims: TokenClaims{UserID: "user-1", SessionID: "sess-1"}},
		fakeClock{now: now},
	)

	_, err := uc.Execute(context.Background(), "token")
	if !errors.Is(err, ErrTokenInvalid) {
		t.Errorf("err = %v", err)
	}
}

func TestValidateSessionUserMismatch(t *testing.T) {
	now := time.Date(2026, 11, 24, 10, 0, 0, 0, time.UTC)
	uc := NewValidateSession(
		&fakeSessionRepo{session: activeSession(now)},
		fakeTokens{claims: TokenClaims{UserID: "someone-else", SessionID: "sess-1"}},
		fakeClock{now: now},
	)

	_, err := uc.Execute(context.Background(), "token")
	if !errors.Is(err, ErrTokenInvalid) {
		t.Errorf("err = %v", err)
	}
}
