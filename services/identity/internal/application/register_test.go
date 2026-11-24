// 注册用例测试
package application

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

// 构造一个所有依赖都正常的用例
func newRegisterForTest() (*Register, *fakeUserRepo, *fakeCodeStore) {
	repo := &fakeUserRepo{}
	store := &fakeCodeStore{code: "2222", found: true}
	uc := NewRegister(
		repo,
		store,
		fakeHasher{},
		fakeIDs{id: "user-1"},
		fakeClock{now: time.Date(2026, 11, 24, 10, 0, 0, 0, time.UTC)},
	)
	return uc, repo, store
}

func TestRegisterWithEmail(t *testing.T) {
	uc, repo, _ := newRegisterForTest()
	email := "a@b.com"

	user, err := uc.Execute(context.Background(), RegisterInput{
		Email:    &email,
		Code:     "2222",
		Password: "password123",
	})
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if user.ID() != "user-1" {
		t.Errorf("id = %q", user.ID())
	}
	if user.Email() == nil || user.Email().String() != "a@b.com" {
		t.Errorf("email = %v", user.Email())
	}
	if user.PasswordHash() != "hashed:password123" {
		t.Errorf("hash = %q", user.PasswordHash())
	}
	if repo.saved != user {
		t.Error("用户没有保存")
	}
}

func TestRegisterWithPhone(t *testing.T) {
	uc, _, _ := newRegisterForTest()
	phone := "13800138000"

	user, err := uc.Execute(context.Background(), RegisterInput{
		Phone:    &phone,
		Code:     "2222",
		Password: "password123",
	})
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if user.Phone() == nil || user.Phone().String() != "13800138000" {
		t.Errorf("phone = %v", user.Phone())
	}
}

func TestRegisterInvalidCode(t *testing.T) {
	uc, _, _ := newRegisterForTest()
	email := "a@b.com"

	_, err := uc.Execute(context.Background(), RegisterInput{
		Email:    &email,
		Code:     "9999",
		Password: "password123",
	})
	if !errors.Is(err, ErrCodeInvalid) {
		t.Errorf("err = %v", err)
	}
}

func TestRegisterCodeNotFound(t *testing.T) {
	uc, _, store := newRegisterForTest()
	store.found = false
	email := "a@b.com"

	_, err := uc.Execute(context.Background(), RegisterInput{
		Email:    &email,
		Code:     "2222",
		Password: "password123",
	})
	if !errors.Is(err, ErrCodeInvalid) {
		t.Errorf("err = %v", err)
	}
}

func TestRegisterIdentifierTaken(t *testing.T) {
	email := "a@b.com"
	phone := "13800138000"

	cases := []struct {
		name  string
		setup func(*fakeUserRepo)
		input RegisterInput
		want  error
	}{
		{
			"邮箱已注册",
			func(r *fakeUserRepo) { r.emailExists = true },
			RegisterInput{Email: &email, Code: "2222", Password: "password123"},
			ErrEmailTaken,
		},
		{
			"手机号已注册",
			func(r *fakeUserRepo) { r.phoneExists = true },
			RegisterInput{Phone: &phone, Code: "2222", Password: "password123"},
			ErrPhoneTaken,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			uc, repo, _ := newRegisterForTest()
			tc.setup(repo)
			_, err := uc.Execute(context.Background(), tc.input)
			if !errors.Is(err, tc.want) {
				t.Errorf("err = %v, want %v", err, tc.want)
			}
		})
	}
}

func TestRegisterPasswordLength(t *testing.T) {
	uc, _, _ := newRegisterForTest()
	email := "a@b.com"

	cases := []struct {
		name     string
		password string
		want     error
	}{
		{"太短", "1234567", ErrPasswordTooShort},
		{"太长", strings.Repeat("a", 73), ErrPasswordTooLong},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := uc.Execute(context.Background(), RegisterInput{
				Email:    &email,
				Code:     "2222",
				Password: tc.password,
			})
			if !errors.Is(err, tc.want) {
				t.Errorf("err = %v, want %v", err, tc.want)
			}
		})
	}
}

func TestRegisterIdentifierMissing(t *testing.T) {
	uc, _, _ := newRegisterForTest()

	_, err := uc.Execute(context.Background(), RegisterInput{
		Code:     "2222",
		Password: "password123",
	})
	if !errors.Is(err, ErrIdentifierMissing) {
		t.Errorf("err = %v", err)
	}
}

func TestRegisterHasherError(t *testing.T) {
	repo := &fakeUserRepo{}
	uc := NewRegister(
		repo,
		&fakeCodeStore{code: "2222", found: true},
		fakeHasher{err: errors.New("hash failed")},
		fakeIDs{id: "user-1"},
		fakeClock{now: time.Now()},
	)
	email := "a@b.com"

	_, err := uc.Execute(context.Background(), RegisterInput{
		Email:    &email,
		Code:     "2222",
		Password: "password123",
	})
	if err == nil {
		t.Fatal("应该返回错误")
	}
}

func TestRegisterSaveError(t *testing.T) {
	repo := &fakeUserRepo{saveErr: errors.New("db down")}
	uc := NewRegister(
		repo,
		&fakeCodeStore{code: "2222", found: true},
		fakeHasher{},
		fakeIDs{id: "user-1"},
		fakeClock{now: time.Now()},
	)
	email := "a@b.com"

	_, err := uc.Execute(context.Background(), RegisterInput{
		Email:    &email,
		Code:     "2222",
		Password: "password123",
	})
	if err == nil {
		t.Fatal("应该返回错误")
	}
}
