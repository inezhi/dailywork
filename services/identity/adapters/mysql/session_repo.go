// 会话仓储的 MySQL 实现
package mysql

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	identityapp "github.com/inezhi/dailywork/services/identity/application"
	"github.com/inezhi/dailywork/services/identity/domain"
)

// 会话仓储
type SessionRepo struct {
	db *gorm.DB
}

// 用已有连接造仓储
func NewSessionRepo(db *gorm.DB) *SessionRepo {
	return &SessionRepo{db: db}
}

// 新建会话
func (r *SessionRepo) Save(ctx context.Context, session *domain.Session) error {
	err := r.db.WithContext(ctx).Create(toSessionRow(session)).Error
	if err != nil {
		return fmt.Errorf("insert session: %w", err)
	}
	return nil
}

// 按 id 查会话
func (r *SessionRepo) FindByID(ctx context.Context, id string) (*domain.Session, error) {
	var row sessionRow
	err := r.db.WithContext(ctx).Where("id = ?", id).Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, identityapp.ErrSessionNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("find session: %w", err)
	}
	return toSessionDomain(&row), nil
}

// 吊销会话；已吊销视为成功，不存在返回错误
func (r *SessionRepo) Revoke(ctx context.Context, id string, now time.Time) error {
	result := r.db.WithContext(ctx).Model(&sessionRow{}).
		Where("id = ? AND revoked_at IS NULL", id).
		Update("revoked_at", now)
	if result.Error != nil {
		return fmt.Errorf("revoke session: %w", result.Error)
	}
	if result.RowsAffected > 0 {
		return nil
	}

	// 没更新到：区分不存在与已吊销
	var count int64
	err := r.db.WithContext(ctx).Model(&sessionRow{}).Where("id = ?", id).Count(&count).Error
	if err != nil {
		return fmt.Errorf("count session: %w", err)
	}
	if count == 0 {
		return identityapp.ErrSessionNotFound
	}
	return nil
}

// 把领域对象转成数据库行
func toSessionRow(session *domain.Session) *sessionRow {
	row := &sessionRow{
		ID:         session.ID(),
		UserID:     session.UserID(),
		Client:     session.Client(),
		ExpiresAt:  session.ExpiresAt(),
		RevokedAt:  session.RevokedAt(),
		LastSeenAt: session.LastSeenAt(),
		CreatedAt:  session.CreatedAt(),
	}

	if session.Device() != "" {
		value := session.Device()
		row.Device = &value
	}
	if session.IP() != "" {
		value := session.IP()
		row.IP = &value
	}

	return row
}

// 把数据库行还原成领域对象
func toSessionDomain(row *sessionRow) *domain.Session {
	device := ""
	if row.Device != nil {
		device = *row.Device
	}
	ip := ""
	if row.IP != nil {
		ip = *row.IP
	}

	return domain.ReconstituteSession(
		row.ID,
		row.UserID,
		row.Client,
		device,
		ip,
		row.ExpiresAt,
		row.RevokedAt,
		row.LastSeenAt,
		row.CreatedAt,
	)
}
