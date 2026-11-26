// 发送验证码用例
package application

import (
	"context"
	"fmt"
	"time"

	"github.com/inezhi/dailywork/services/identity/domain"
)

// 验证码有效期
const codeTTL = 5 * time.Minute

// 开发环境固定验证码；接入真实短信/邮件后换成随机数
const devVerificationCode = "2222"

// 发送验证码的入参
type SendCodeInput struct {
	Email *string
	Phone *string
}

// SendCode 生成并保存验证码
type SendCode struct {
	codes VerificationCodeStore
}

// 注入验证码存储
func NewSendCode(codes VerificationCodeStore) *SendCode {
	return &SendCode{codes: codes}
}

// 校验标识并保存验证码，返回渠道 email 或 phone
func (uc *SendCode) Execute(ctx context.Context, in SendCodeInput) (string, error) {
	id, err := parseIdentifier(in.Email, in.Phone)
	if err != nil {
		return "", err
	}

	err = uc.codes.Save(ctx, id.key, devVerificationCode, codeTTL)
	if err != nil {
		return "", fmt.Errorf("save code: %w", err)
	}
	return id.channel, nil
}

// 邮箱/手机号二选一校验后的结果
type identifier struct {
	key     string
	channel string
	email   *domain.Email
	phone   *domain.Phone
}

// 校验恰好传一个，并转成领域值对象
func parseIdentifier(email *string, phone *string) (identifier, error) {
	if email == nil && phone == nil {
		return identifier{}, ErrIdentifierMissing
	}
	if email != nil && phone != nil {
		return identifier{}, ErrIdentifierBoth
	}
	if email != nil {
		parsed, err := domain.NewEmail(*email)
		if err != nil {
			return identifier{}, err
		}
		return identifier{key: "email:" + parsed.String(), channel: "email", email: &parsed}, nil
	}

	parsed, err := domain.NewPhone(*phone)
	if err != nil {
		return identifier{}, err
	}
	return identifier{key: "phone:" + parsed.String(), channel: "phone", phone: &parsed}, nil
}
