// 登出用例测试
package application

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestLogout(t *testing.T) {
	now := time.Date(2026, 11, 24, 10, 0, 0, 0, time.UTC)
	sessions := &fakeSessionRepo{}
	uc := NewLogout(sessions, fakeClock{now: now})

	err := uc.Execute(context.Background(), "sess-1")
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if sessions.revokedID != "sess-1" {
		t.Errorf("revokedID = %q", sessions.revokedID)
	}
}

func TestLogoutError(t *testing.T) {
	sessions := &fakeSessionRepo{revokeErr: errors.New("db down")}
	uc := NewLogout(sessions, fakeClock{now: time.Now()})

	if err := uc.Execute(context.Background(), "sess-1"); err == nil {
		t.Fatal("应该返回错误")
	}
}
