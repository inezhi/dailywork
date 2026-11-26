// 发送验证码用例测试
package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/inezhi/dailywork/services/identity/domain"
)

func TestSendCodeEmail(t *testing.T) {
	store := &fakeCodeStore{}
	uc := NewSendCode(store)
	email := "a@b.com"

	channel, err := uc.Execute(context.Background(), SendCodeInput{Email: &email})
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if channel != "email" {
		t.Errorf("channel = %q", channel)
	}
	if store.savedKey != "email:a@b.com" {
		t.Errorf("key = %q", store.savedKey)
	}
	if store.savedCode != "2222" {
		t.Errorf("code = %q", store.savedCode)
	}
	if store.savedTTL != 5*time.Minute {
		t.Errorf("ttl = %v", store.savedTTL)
	}
}

func TestSendCodePhone(t *testing.T) {
	store := &fakeCodeStore{}
	uc := NewSendCode(store)
	phone := "13800138000"

	channel, err := uc.Execute(context.Background(), SendCodeInput{Phone: &phone})
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if channel != "phone" {
		t.Errorf("channel = %q", channel)
	}
	if store.savedKey != "phone:13800138000" {
		t.Errorf("key = %q", store.savedKey)
	}
}

func TestSendCodeInvalidInput(t *testing.T) {
	uc := NewSendCode(&fakeCodeStore{})
	email := "a@b.com"
	phone := "13800138000"
	badEmail := "abc"
	badPhone := "123"

	cases := []struct {
		name  string
		input SendCodeInput
		want  error
	}{
		{"都没有", SendCodeInput{}, ErrIdentifierMissing},
		{"两个都有", SendCodeInput{Email: &email, Phone: &phone}, ErrIdentifierBoth},
		{"邮箱格式不对", SendCodeInput{Email: &badEmail}, domain.ErrEmailInvalid},
		{"手机号格式不对", SendCodeInput{Phone: &badPhone}, domain.ErrPhoneInvalid},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := uc.Execute(context.Background(), tc.input)
			if !errors.Is(err, tc.want) {
				t.Errorf("err = %v, want %v", err, tc.want)
			}
		})
	}
}

func TestSendCodeStoreError(t *testing.T) {
	store := &fakeCodeStore{saveErr: errors.New("redis down")}
	uc := NewSendCode(store)
	email := "a@b.com"

	_, err := uc.Execute(context.Background(), SendCodeInput{Email: &email})
	if err == nil {
		t.Fatal("应该返回错误")
	}
}
