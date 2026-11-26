// 登录用例测试
package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/inezhi/dailywork/services/identity/domain"
)

// 造一个测试用户
func testUser() *domain.User {
	email, _ := domain.NewEmail("a@b.com")
	now := time.Date(2026, 11, 24, 10, 0, 0, 0, time.UTC)
	return domain.Reconstitute("user-1", &email, nil, "hash", "", 0, now, now)
}

func TestLoginWithEmail(t *testing.T) {
	now := time.Date(2026, 11, 24, 10, 0, 0, 0, time.UTC)
	sessions := &fakeSessionRepo{}
	uc := NewLogin(
		&fakeUserRepo{byEmail: testUser()},
		sessions,
		fakeHasher{},
		fakeTokens{signToken: "token-1"},
		fakeIDs{id: "sess-1"},
		fakeClock{now: now},
	)
	email := "a@b.com"

	result, err := uc.Execute(context.Background(), LoginInput{
		Email:    &email,
		Password: "password123",
	})
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if result.Token != "token-1" {
		t.Errorf("token = %q", result.Token)
	}
	if result.UserID != "user-1" {
		t.Errorf("userId = %q", result.UserID)
	}
	if !result.ExpiresAt.Equal(now.Add(30 * 24 * time.Hour)) {
		t.Errorf("expiresAt = %v", result.ExpiresAt)
	}
	if sessions.saved == nil || sessions.saved.ID() != "sess-1" {
		t.Error("会话没有保存")
	}
	if sessions.saved.Client() != "web" {
		t.Errorf("client = %q", sessions.saved.Client())
	}
}

func TestLoginWithPhone(t *testing.T) {
	phone, _ := domain.NewPhone("13800138000")
	user := domain.Reconstitute("user-2", nil, &phone, "hash", "", 0, time.Now(), time.Now())
	uc := NewLogin(
		&fakeUserRepo{byPhone: user},
		&fakeSessionRepo{},
		fakeHasher{},
		fakeTokens{signToken: "token-2"},
		fakeIDs{id: "sess-2"},
		fakeClock{now: time.Now()},
	)
	phoneStr := "13800138000"

	_, err := uc.Execute(context.Background(), LoginInput{
		Phone:    &phoneStr,
		Password: "password123",
	})
	if err != nil {
		t.Fatalf("err = %v", err)
	}
}

func TestLoginWrongPassword(t *testing.T) {
	uc := NewLogin(
		&fakeUserRepo{byEmail: testUser()},
		&fakeSessionRepo{},
		fakeHasher{verifyErr: errors.New("mismatch")},
		fakeTokens{},
		fakeIDs{id: "sess-1"},
		fakeClock{now: time.Now()},
	)
	email := "a@b.com"

	_, err := uc.Execute(context.Background(), LoginInput{Email: &email, Password: "wrong"})
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("err = %v", err)
	}
}

func TestLoginUserNotFound(t *testing.T) {
	uc := NewLogin(
		&fakeUserRepo{},
		&fakeSessionRepo{},
		fakeHasher{},
		fakeTokens{},
		fakeIDs{id: "sess-1"},
		fakeClock{now: time.Now()},
	)
	email := "nobody@example.com"

	_, err := uc.Execute(context.Background(), LoginInput{Email: &email, Password: "password123"})
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("err = %v", err)
	}
}

func TestLoginSessionSaveError(t *testing.T) {
	uc := NewLogin(
		&fakeUserRepo{byEmail: testUser()},
		&fakeSessionRepo{saveErr: errors.New("db down")},
		fakeHasher{},
		fakeTokens{},
		fakeIDs{id: "sess-1"},
		fakeClock{now: time.Now()},
	)
	email := "a@b.com"

	_, err := uc.Execute(context.Background(), LoginInput{Email: &email, Password: "password123"})
	if err == nil {
		t.Fatal("应该返回错误")
	}
}

func TestLoginIdentifierMissing(t *testing.T) {
	uc := NewLogin(
		&fakeUserRepo{},
		&fakeSessionRepo{},
		fakeHasher{},
		fakeTokens{},
		fakeIDs{id: "sess-1"},
		fakeClock{now: time.Now()},
	)

	_, err := uc.Execute(context.Background(), LoginInput{Password: "password123"})
	if !errors.Is(err, ErrIdentifierMissing) {
		t.Errorf("err = %v", err)
	}
}
