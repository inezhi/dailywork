// JWT 的签发与校验
package jwt

import (
	"fmt"
	"time"

	jwtx "github.com/golang-jwt/jwt/v5"

	identityapp "github.com/inezhi/dailywork/services/identity/application"
)

// JWT 管理器
type TokenManager struct {
	secret []byte
}

// 用签名密钥造管理器
func New(secret string) *TokenManager {
	return &TokenManager{secret: []byte(secret)}
}

// 签发 JWT：sub 是用户 id，jti 是会话 id
func (m *TokenManager) Sign(userID string, sessionID string, expiresAt time.Time) (string, error) {
	claims := jwtx.RegisteredClaims{
		Subject:   userID,
		ID:        sessionID,
		ExpiresAt: jwtx.NewNumericDate(expiresAt),
		IssuedAt:  jwtx.NewNumericDate(time.Now()),
	}

	token := jwtx.NewWithClaims(jwtx.SigningMethodHS256, claims)
	signed, err := token.SignedString(m.secret)
	if err != nil {
		return "", fmt.Errorf("sign token: %w", err)
	}
	return signed, nil
}

// 校验 JWT 并取出声明
func (m *TokenManager) Verify(token string) (identityapp.TokenClaims, error) {
	claims := &jwtx.RegisteredClaims{}
	parsed, err := jwtx.ParseWithClaims(token, claims, func(t *jwtx.Token) (interface{}, error) {
		return m.secret, nil
	})
	if err != nil || !parsed.Valid {
		return identityapp.TokenClaims{}, identityapp.ErrTokenInvalid
	}
	if claims.ExpiresAt == nil {
		return identityapp.TokenClaims{}, identityapp.ErrTokenInvalid
	}

	return identityapp.TokenClaims{
		UserID:    claims.Subject,
		SessionID: claims.ID,
		ExpiresAt: claims.ExpiresAt.Time,
	}, nil
}
