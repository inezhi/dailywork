// 把 outbox 里的事件投递到 Kafka
package outbox

import (
	"context"
	"log/slog"
	"time"

	"github.com/segmentio/kafka-go"
)

// 每批最多投递多少条
const relayBatchSize = 100

// Relay 轮询 outbox 并投递
type Relay struct {
	store    *Store
	writer   *kafka.Writer
	interval time.Duration
}

// 用存储、brokers、topic 造 relay
func NewRelay(store *Store, brokers []string, topic string, interval time.Duration) *Relay {
	writer := &kafka.Writer{
		Addr:         kafka.TCP(brokers...),
		Topic:        topic,
		Balancer:     &kafka.Hash{},
		RequiredAcks: kafka.RequireAll,
	}
	return &Relay{store: store, writer: writer, interval: interval}
}

// 循环投递，直到 context 取消
func (r *Relay) Run(ctx context.Context) {
	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.publishBatch(ctx)
		}
	}
}

// 取一批、逐条发、发成功就标记
func (r *Relay) publishBatch(ctx context.Context) {
	messages, err := r.store.FetchUnpublished(ctx, relayBatchSize)
	if err != nil {
		slog.Error("fetch outbox", "err", err)
		return
	}

	for _, message := range messages {
		err = r.writer.WriteMessages(ctx, kafka.Message{
			Key:   []byte(message.AggregateID),
			Value: message.Payload,
		})
		if err != nil {
			slog.Error("publish event", "err", err, "eventId", message.ID)
			continue
		}

		err = r.store.MarkPublished(ctx, []string{message.ID})
		if err != nil {
			slog.Error("mark event published", "err", err, "eventId", message.ID)
		}
	}
}

// 关闭 writer
func (r *Relay) Close() error {
	return r.writer.Close()
}
