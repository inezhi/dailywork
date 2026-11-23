// 任务服务入口：读配置、连库、装配依赖、起 Kitex 服务。
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cloudwego/kitex/server"
	"github.com/google/uuid"

	"github.com/inezhi/dailywork/api/gen/rpc/dailyworkservice"
	"github.com/inezhi/dailywork/services/task/internal/adapters/kitex"
	"github.com/inezhi/dailywork/services/task/internal/adapters/mysql"
	"github.com/inezhi/dailywork/services/task/internal/application"
)

type config struct {
	DSN  string // TASK_MYSQL_DSN，必填
	Addr string // TASK_ADDR，默认 127.0.0.1:8888
}

// loadConfig 从环境变量读配置，缺 DSN 直接报错。
func loadConfig() (config, error) {
	c := config{
		DSN:  os.Getenv("TASK_MYSQL_DSN"),
		Addr: getenv("TASK_ADDR", "127.0.0.1:8888"),
	}
	if c.DSN == "" {
		return c, fmt.Errorf("TASK_MYSQL_DSN is required")
	}
	return c, nil
}

// getenv 读环境变量，空值时用默认值。
func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// uuidGen 实现 application.IDGenerator，Go 里只有类型能实现接口
type uuidGen struct{}

// NewID 返回一个 UUIDv4。
func (uuidGen) NewID() string { return uuid.NewString() }

// systemClock 实现 application.Clock；统一用 UTC。
type systemClock struct{}

// Now 返回 UTC 当前时间。
func (systemClock) Now() time.Time { return time.Now().UTC() }

// main 配置 JSON 日志，执行 run，失败时以非零码退出。
func main() {
	// 日志一行一条 JSON，便于收集和检索
	logHandler := slog.NewJSONHandler(os.Stdout, nil) // 修改策略为Stdout+JSON格式
	slog.SetDefault(slog.New(logHandler))             // 把默认实现换成我们的

	err := run()
	if err != nil {
		slog.Error("task service exited", "err", err)
		os.Exit(1)
	}
}

// run 走完整个启动流程；返回错误表示启动失败。
func run() error {
	// 1. 读配置：DSN 必填，监听地址有默认值
	cfg, err := loadConfig()
	if err != nil {
		return err
	}

	// 2. 连库；ping 不通就不开始接请求
	db, err := mysql.Open(cfg.DSN) // 连库并返回 *gorm.DB
	if err != nil {
		return err
	}
	sqlDB, err := db.DB() // 拿到底层sqlDB，用来配置连接池
	if err != nil {
		return fmt.Errorf("get sql.DB: %w", err)
	}
	defer sqlDB.Close()

	// 连接池：最多 20 条、空闲 10 条，连接一小时后重建
	sqlDB.SetMaxOpenConns(20)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// 造一个 5 秒后自动取消的上下文
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 向数据库发一个"ping"，验证连接可用，最多等待5秒
	if err := sqlDB.PingContext(pingCtx); err != nil {
		return fmt.Errorf("ping mysql: %w", err)
	}

	// 3. 装配：仓储 → 用例 → handler
	repo := mysql.New(db)
	createTask := application.NewCreateTask(repo, uuidGen{}, systemClock{}) // 这里就是那三个组装起来的接口struct
	handler := kitex.New(createTask)

	addr, err := net.ResolveTCPAddr("tcp", cfg.Addr)
	if err != nil {
		return fmt.Errorf("resolve addr %q: %w", cfg.Addr, err)
	}

	// 4. 起服务；Run 会阻塞，单独放 goroutine 里以便处理退出信号
	svr := dailyworkservice.NewServer(handler, server.WithServiceAddr(addr))

	runErr := make(chan error, 1)
	go func() { runErr <- svr.Run() }()
	slog.Info("task service listening", "addr", cfg.Addr)

	// 5. 收到 Ctrl-C 或 SIGTERM 时优雅停止
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-runErr:
		return err
	case sig := <-quit:
		slog.Info("shutting down", "signal", sig.String())
		return svr.Stop()
	}
}
