// 密码哈希的 bcrypt 实现
package bcrypt

import (
	"fmt"

	xbcrypt "golang.org/x/crypto/bcrypt"
)

// 密码哈希器
type Hasher struct{}

// 造一个哈希器
func New() *Hasher {
	return &Hasher{}
}

// 生成 bcrypt 哈希
func (h *Hasher) Hash(password string) (string, error) {
	hash, err := xbcrypt.GenerateFromPassword([]byte(password), xbcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("bcrypt: %w", err)
	}
	return string(hash), nil
}
