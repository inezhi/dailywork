// 任务服务入口：读配置、连库、装配依赖、起 Kitex 服务。
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cloudwego/kitex/server"
	"github.com/google/uuid"
	"gopkg.in/yaml.v3"

	"github.com/inezhi/dailywork/api/gen/rpc/dailyworkservice"
	identitybcrypt "github.com/inezhi/dailywork/services/identity/adapters/bcrypt"
	identitymysql "github.com/inezhi/dailywork/services/identity/adapters/mysql"
	identityredis "github.com/inezhi/dailywork/services/identity/adapters/redis"
	identityapp "github.com/inezhi/dailywork/services/identity/application"
	"github.com/inezhi/dailywork/services/task/internal/adapters/kitex"
	"github.com/inezhi/dailywork/services/task/internal/adapters/mysql"
	"github.com/inezhi/dailywork/services/task/internal/application"
)

type config struct {
	Server serverConfig `yaml:"server"`
	MySQL  mysqlConfig  `yaml:"mysql"`
	Redis  redisConfig  `yaml:"redis"`
}

// serverConfig 是 Kitex 服务的监听配置。
type serverConfig struct {
	Addr string `yaml:"addr"`
}

// mysqlConfig 是数据库连接配置。
type mysqlConfig struct {
	DSN string `yaml:"dsn"`
}

// redisConfig 是 Redis 连接配置。
type redisConfig struct {
	Addr     string `yaml:"addr"`
	Password string `yaml:"password"`
}

// loadConfig 读 YAML 文件，并校验必填项。
func loadConfig(path string) (config, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return config{}, fmt.Errorf("read config %s: %w", path, err)
	}

	var cfg config
	err = yaml.Unmarshal(content, &cfg)
	if err != nil {
		return config{}, fmt.Errorf("parse config %s: %w", path, err)
	}

	if cfg.Server.Addr == "" {
		return config{}, fmt.Errorf("config %s: server.addr is required", path)
	}
	// 没有数据库连接串就起不来
	if cfg.MySQL.DSN == "" {
		return config{}, fmt.Errorf("config %s: mysql.dsn is required", path)
	}
	// 没有 Redis 地址就没法存验证码
	if cfg.Redis.Addr == "" {
		return config{}, fmt.Errorf("config %s: redis.addr is required", path)
	}

	return cfg, nil
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
	// -config 指定读取哪个 YAML 文件
	configPath := flag.String("config", "deploy/task.yaml", "YAML 配置文件路径")
	flag.Parse()

	// 日志一行一条 JSON，便于收集和检索
	logHandler := slog.NewJSONHandler(os.Stdout, nil) // 修改策略为Stdout+JSON格式
	slog.SetDefault(slog.New(logHandler))             // 把默认实现换成我们的

	err := run(*configPath)
	if err != nil {
		slog.Error("task service exited", "err", err)
		os.Exit(1)
	}
}

// run 走完整个启动流程；返回错误表示启动失败。
func run(configPath string) error {
	// 1. 读配置：server.addr 与 mysql.dsn 都必填
	cfg, err := loadConfig(configPath)
	if err != nil {
		return err
	}

	// 2. 连库；ping 不通就不开始接请求
	db, err := mysql.Open(cfg.MySQL.DSN) // 连库并返回 *gorm.DB
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

	// 3. 连 Redis；验证码存在这里
	redisClient := identityredis.Open(cfg.Redis.Addr, cfg.Redis.Password)
	defer redisClient.Close()

	if err := redisClient.Ping(pingCtx).Err(); err != nil {
		return fmt.Errorf("ping redis: %w", err)
	}

	// 4. 装配：仓储 → 用例 → handler
	taskRepo := mysql.New(db)
	createTask := application.NewCreateTask(taskRepo, uuidGen{}, systemClock{}) // 这里就是那三个组装起来的接口struct

	userRepo := identitymysql.NewUserRepo(db)
	codeStore := identityredis.NewCodeStore(redisClient)
	identityHasher := identitybcrypt.New()
	sendCode := identityapp.NewSendCode(codeStore)
	register := identityapp.NewRegister(userRepo, codeStore, identityHasher, uuidGen{}, systemClock{})

	handler := kitex.New(createTask, sendCode, register)

	addr, err := net.ResolveTCPAddr("tcp", cfg.Server.Addr)
	if err != nil {
		return fmt.Errorf("resolve addr %q: %w", cfg.Server.Addr, err)
	}

	// 4. 起服务；Run 会阻塞，单独放 goroutine 里以便处理退出信号
	svr := dailyworkservice.NewServer(handler, server.WithServiceAddr(addr))

	runErr := make(chan error, 1)
	go func() { runErr <- svr.Run() }()
	slog.Info("task service listening", "addr", cfg.Server.Addr)

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
