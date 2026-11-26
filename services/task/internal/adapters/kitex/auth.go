// 认证方法的 RPC 适配器：协议转换与错误映射
package kitex

import (
	"context"
	"errors"
	"log/slog"

	"github.com/inezhi/dailywork/api/gen/base"
	"github.com/inezhi/dailywork/api/gen/rpc"
	identityapp "github.com/inezhi/dailywork/services/identity/application"
	identitydomain "github.com/inezhi/dailywork/services/identity/domain"
)

// 发送验证码
func (h *Handler) SendCode(ctx context.Context, req *rpc.SendCodeReq) (*rpc.SendCodeResp, error) {
	channel, err := h.sendCode.Execute(ctx, identityapp.SendCodeInput{
		Email: req.Email,
		Phone: req.Phone,
	})
	if err != nil {
		return &rpc.SendCodeResp{BaseResp: identityErrResp(err)}, nil
	}
	return &rpc.SendCodeResp{Channel: channel, BaseResp: okResp()}, nil
}

// 注册账户
func (h *Handler) Register(ctx context.Context, req *rpc.RegisterReq) (*rpc.RegisterResp, error) {
	user, err := h.register.Execute(ctx, identityapp.RegisterInput{
		Email:    req.Email,
		Phone:    req.Phone,
		Code:     req.Code,
		Password: req.Password,
	})
	if err != nil {
		slog.Warn("register failed", "err", err, "requestId", logID(req.Base))
		return &rpc.RegisterResp{BaseResp: identityErrResp(err)}, nil
	}
	return &rpc.RegisterResp{UserId: user.ID(), BaseResp: okResp()}, nil
}

// 把 identity 的错误翻译成状态码和提示
func identityErrResp(err error) *base.BaseResp {
	code, message := classifyIdentity(err)
	return &base.BaseResp{StatusCode: code, StatusMessage: message}
}

// identity 错误的分类表
func classifyIdentity(err error) (int32, string) {
	switch {
	case errors.Is(err, identityapp.ErrEmailTaken),
		errors.Is(err, identityapp.ErrPhoneTaken):
		return codeConflict, "邮箱或手机号已注册"
	case errors.Is(err, identityapp.ErrCodeInvalid):
		return codeInvalid, "验证码无效"
	case errors.Is(err, identityapp.ErrIdentifierMissing):
		return codeInvalid, "邮箱或手机号必填"
	case errors.Is(err, identityapp.ErrIdentifierBoth):
		return codeInvalid, "邮箱和手机号只能二选一"
	case errors.Is(err, identityapp.ErrPasswordTooShort):
		return codeInvalid, "密码至少 8 位"
	case errors.Is(err, identityapp.ErrPasswordTooLong):
		return codeInvalid, "密码最多 72 字节"
	case errors.Is(err, identitydomain.ErrEmailInvalid):
		return codeInvalid, "邮箱格式不对"
	case errors.Is(err, identitydomain.ErrPhoneInvalid):
		return codeInvalid, "手机号格式不对"
	default:
		slog.Error("identity internal error", "err", err)
		return codeInternal, "服务端错误"
	}
}
