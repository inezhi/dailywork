// outbox 表的读写
package outbox

import (
	"context"
	"fmt"

	"gorm.io/gorm"
)

// 一条待发布事件
type Message struct {
	ID          string
	AggregateID string
	Payload     []byte
}

// 读写 outbox 表
type Store struct {
	db *gorm.DB
}

// 用已有连接造存储
func NewStore(db *gorm.DB) *Store {
	return &Store{db: db}
}

// 取未发布事件，按创建时间先来先发
func (s *Store) FetchUnpublished(ctx context.Context, limit int) ([]Message, error) {
	var rows []struct {
		ID          string
		AggregateID string
		Payload     []byte
	}

	err := s.db.WithContext(ctx).
		Raw(`SELECT id, aggregate_id, payload FROM outbox
			WHERE published_at IS NULL
			ORDER BY created_at
			LIMIT ?`, limit).
		Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("fetch outbox: %w", err)
	}

	messages := make([]Message, 0, len(rows))
	for _, row := range rows {
		messages = append(messages, Message{
			ID:          row.ID,
			AggregateID: row.AggregateID,
			Payload:     row.Payload,
		})
	}
	return messages, nil
}

// 标记已发布
func (s *Store) MarkPublished(ctx context.Context, ids []string) error {
	err := s.db.WithContext(ctx).
		Table("outbox").
		Where("id IN ?", ids).
		UpdateColumn("published_at", gorm.Expr("NOW(3)")).Error
	if err != nil {
		return fmt.Errorf("mark outbox published: %w", err)
	}
	return nil
}
