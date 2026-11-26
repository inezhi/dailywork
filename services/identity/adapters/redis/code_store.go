// 验证码存储的 Redis 实现
package redis

import (
	"context"
	"errors"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

// 验证码 key 的统一前缀
const codeKeyPrefix = "auth:code:"

// 验证码存储
type CodeStore struct {
	client *goredis.Client
}

// 用已有连接造存储
func NewCodeStore(client *goredis.Client) *CodeStore {
	return &CodeStore{client: client}
}

// 连接 Redis
func Open(addr string, password string) *goredis.Client {
	return goredis.NewClient(&goredis.Options{
		Addr:     addr,
		Password: password,
	})
}

// 写入验证码并设置过期时间
func (s *CodeStore) Save(ctx context.Context, key string, code string, ttl time.Duration) error {
	err := s.client.Set(ctx, codeKeyPrefix+key, code, ttl).Err()
	if err != nil {
		return fmt.Errorf("set code: %w", err)
	}
	return nil
}

// 取出并删除验证码；不存在时返回 found=false
func (s *CodeStore) Take(ctx context.Context, key string) (string, bool, error) {
	value, err := s.client.GetDel(ctx, codeKeyPrefix+key).Result()
	if errors.Is(err, goredis.Nil) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("getdel code: %w", err)
	}
	return value, true, nil
}
