// 登录会话聚合
package domain

import (
	"errors"
	"time"
)

var (
	// session id 为空
	ErrSessionIDMissing = errors.New("domain: session id is required")
	// 归属用户为空
	ErrSessionUserMissing = errors.New("domain: session user is required")
)

// Session 是一次登录的会话
type Session struct {
	id         string
	userID     string
	client     string
	device     string
	ip         string
	expiresAt  time.Time
	revokedAt  *time.Time
	lastSeenAt *time.Time
	createdAt  time.Time
}

// 创建会话需要的字段
type NewSessionParams struct {
	ID        string
	UserID    string
	Client    string
	Device    string
	IP        string
	ExpiresAt time.Time
	Now       time.Time
}

// 校验并创建会话
func NewSession(p NewSessionParams) (*Session, error) {
	if p.ID == "" {
		return nil, ErrSessionIDMissing
	}
	if p.UserID == "" {
		return nil, ErrSessionUserMissing
	}

	return &Session{
		id:        p.ID,
		userID:    p.UserID,
		client:    p.Client,
		device:    p.Device,
		ip:        p.IP,
		expiresAt: p.ExpiresAt,
		createdAt: p.Now,
	}, nil
}

// 从数据库还原会话
func ReconstituteSession(
	id string,
	userID string,
	client string,
	device string,
	ip string,
	expiresAt time.Time,
	revokedAt *time.Time,
	lastSeenAt *time.Time,
	createdAt time.Time,
) *Session {
	return &Session{
		id:         id,
		userID:     userID,
		client:     client,
		device:     device,
		ip:         ip,
		expiresAt:  expiresAt,
		revokedAt:  revokedAt,
		lastSeenAt: lastSeenAt,
		createdAt:  createdAt,
	}
}

// 会话是否有效：未吊销且未过期
func (s *Session) IsActive(now time.Time) bool {
	if s.revokedAt != nil {
		return false
	}
	return now.Before(s.expiresAt)
}

// 吊销会话；已经吊销时什么都不做
func (s *Session) Revoke(now time.Time) {
	if s.revokedAt != nil {
		return
	}
	s.revokedAt = &now
}

// 返回会话 id
func (s *Session) ID() string { return s.id }

// 返回归属用户
func (s *Session) UserID() string { return s.userID }

// 返回客户端类型
func (s *Session) Client() string { return s.client }

// 返回设备描述
func (s *Session) Device() string { return s.device }

// 返回客户端 IP
func (s *Session) IP() string { return s.ip }

// 返回过期时间
func (s *Session) ExpiresAt() time.Time { return s.expiresAt }

// 返回吊销时间
func (s *Session) RevokedAt() *time.Time { return s.revokedAt }

// 返回最近活跃时间
func (s *Session) LastSeenAt() *time.Time { return s.lastSeenAt }

// 返回创建时间
func (s *Session) CreatedAt() time.Time { return s.createdAt }
