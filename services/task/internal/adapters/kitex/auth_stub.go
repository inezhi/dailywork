// 认证方法的临时桩：契约先落地，实现按后续步骤逐个补
package kitex

import (
	"context"

	"github.com/inezhi/dailywork/api/gen/base"
	"github.com/inezhi/dailywork/api/gen/rpc"
)

// 返回 500，表示还没实现
func notImplemented() *base.BaseResp {
	return &base.BaseResp{StatusCode: 500, StatusMessage: "未实现"}
}

// 尚未实现
func (h *Handler) SendCode(ctx context.Context, req *rpc.SendCodeReq) (*rpc.SendCodeResp, error) {
	return &rpc.SendCodeResp{BaseResp: notImplemented()}, nil
}

// 尚未实现
func (h *Handler) Register(ctx context.Context, req *rpc.RegisterReq) (*rpc.RegisterResp, error) {
	return &rpc.RegisterResp{BaseResp: notImplemented()}, nil
}

// 尚未实现
func (h *Handler) Login(ctx context.Context, req *rpc.LoginReq) (*rpc.LoginResp, error) {
	return &rpc.LoginResp{BaseResp: notImplemented()}, nil
}

// 尚未实现
func (h *Handler) Logout(ctx context.Context, req *rpc.LogoutReq) (*rpc.LogoutResp, error) {
	return &rpc.LogoutResp{BaseResp: notImplemented()}, nil
}

// 尚未实现
func (h *Handler) ValidateSession(ctx context.Context, req *rpc.ValidateSessionReq) (*rpc.ValidateSessionResp, error) {
	return &rpc.ValidateSessionResp{BaseResp: notImplemented()}, nil
}
