// 用户领域规则测试
package domain

import (
	"errors"
	"testing"
	"time"
)

func TestNewEmail(t *testing.T) {
	valid := []string{"a@b.com", "first.last@example.co"}
	for _, value := range valid {
		if _, err := NewEmail(value); err != nil {
			t.Errorf("%q: %v", value, err)
		}
	}

	invalid := []string{"", "abc", "a@b", "a b@c.com", "@b.com", "a@.com"}
	for _, value := range invalid {
		if _, err := NewEmail(value); !errors.Is(err, ErrEmailInvalid) {
			t.Errorf("%q: err = %v", value, err)
		}
	}
}

func TestNewPhone(t *testing.T) {
	valid := []string{"13800138000", "19912345678"}
	for _, value := range valid {
		if _, err := NewPhone(value); err != nil {
			t.Errorf("%q: %v", value, err)
		}
	}

	invalid := []string{"", "12345678901", "1380013800", "138001380001", "abcdefghijk"}
	for _, value := range invalid {
		if _, err := NewPhone(value); !errors.Is(err, ErrPhoneInvalid) {
			t.Errorf("%q: err = %v", value, err)
		}
	}
}

func TestNewUser(t *testing.T) {
	now := time.Date(2026, 11, 24, 10, 0, 0, 0, time.UTC)
	email, _ := NewEmail("a@b.com")
	phone, _ := NewPhone("13800138000")

	onlyEmail, err := NewUser(NewUserParams{ID: "u1", Email: &email, PasswordHash: "hash", Now: now})
	if err != nil {
		t.Fatalf("email only: %v", err)
	}
	if onlyEmail.MembershipLevel() != 0 || onlyEmail.AvatarURL() != "" {
		t.Error("默认值不对")
	}
	if !onlyEmail.CreatedAt().Equal(now) {
		t.Error("createdAt 不对")
	}

	onlyPhone, err := NewUser(NewUserParams{ID: "u2", Phone: &phone, PasswordHash: "hash", Now: now})
	if err != nil {
		t.Fatalf("phone only: %v", err)
	}
	if onlyPhone.Email() != nil {
		t.Error("邮箱应该为空")
	}
}

func TestNewUserInvalid(t *testing.T) {
	now := time.Now()
	email, _ := NewEmail("a@b.com")
	phone, _ := NewPhone("13800138000")

	cases := []struct {
		name   string
		params NewUserParams
		want   error
	}{
		{"都没有", NewUserParams{ID: "u", PasswordHash: "h", Now: now}, ErrIdentifierMissing},
		{"两个都有", NewUserParams{ID: "u", Email: &email, Phone: &phone, PasswordHash: "h", Now: now}, ErrIdentifierBoth},
		{"哈希为空", NewUserParams{ID: "u", Email: &email, Now: now}, ErrPasswordHashEmpty},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := NewUser(tc.params)
			if !errors.Is(err, tc.want) {
				t.Errorf("err = %v, want %v", err, tc.want)
			}
		})
	}
}

func TestReconstitute(t *testing.T) {
	now := time.Date(2026, 11, 24, 10, 0, 0, 0, time.UTC)
	email, _ := NewEmail("a@b.com")

	user := Reconstitute("u1", &email, nil, "hash", "https://avatar", 1, now, now)
	if user.ID() != "u1" || user.PasswordHash() != "hash" {
		t.Error("字段没有还原")
	}
	if user.AvatarURL() != "https://avatar" || user.MembershipLevel() != 1 {
		t.Error("头像或等级没有还原")
	}
}
