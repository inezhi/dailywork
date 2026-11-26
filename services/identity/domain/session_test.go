// 会话领域规则测试
package domain

import (
	"errors"
	"testing"
	"time"
)

func TestNewSession(t *testing.T) {
	now := time.Date(2026, 11, 24, 10, 0, 0, 0, time.UTC)
	expires := now.Add(24 * time.Hour)

	session, err := NewSession(NewSessionParams{
		ID:        "s1",
		UserID:    "u1",
		Client:    "web",
		ExpiresAt: expires,
		Now:       now,
	})
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if !session.IsActive(now) {
		t.Error("新会话应该是有效的")
	}
	if session.CreatedAt() != now {
		t.Errorf("createdAt = %v", session.CreatedAt())
	}
}

func TestNewSessionInvalid(t *testing.T) {
	now := time.Now()

	cases := []struct {
		name   string
		params NewSessionParams
		want   error
	}{
		{"没有 id", NewSessionParams{UserID: "u1", Now: now}, ErrSessionIDMissing},
		{"没有用户", NewSessionParams{ID: "s1", Now: now}, ErrSessionUserMissing},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := NewSession(tc.params)
			if !errors.Is(err, tc.want) {
				t.Errorf("err = %v, want %v", err, tc.want)
			}
		})
	}
}

func TestSessionExpiry(t *testing.T) {
	now := time.Date(2026, 11, 24, 10, 0, 0, 0, time.UTC)
	expires := now.Add(time.Hour)

	session, _ := NewSession(NewSessionParams{
		ID:        "s1",
		UserID:    "u1",
		Client:    "web",
		ExpiresAt: expires,
		Now:       now,
	})

	if !session.IsActive(now) {
		t.Error("过期前应该有效")
	}
	if session.IsActive(expires) {
		t.Error("到点后应该失效")
	}
}

func TestSessionRevoke(t *testing.T) {
	now := time.Date(2026, 11, 24, 10, 0, 0, 0, time.UTC)

	session, _ := NewSession(NewSessionParams{
		ID:        "s1",
		UserID:    "u1",
		Client:    "web",
		ExpiresAt: now.Add(time.Hour),
		Now:       now,
	})

	session.Revoke(now)
	if session.IsActive(now) {
		t.Error("吊销后应该失效")
	}
	if session.RevokedAt() == nil {
		t.Error("revokedAt 应该被写入")
	}

	// 再吊销一次不改变第一次的时间
	later := now.Add(time.Minute)
	session.Revoke(later)
	if !session.RevokedAt().Equal(now) {
		t.Error("重复吊销不应该改时间")
	}
}
