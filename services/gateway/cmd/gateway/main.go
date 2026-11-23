// gateway 入口：读配置、起 Hertz HTTP 服务。
package main

import (
	"context"  // 请求上下文，用来传超时和取消信号
	"flag"     // 解析 -config 这类命令行参数
	"fmt"      // 拼错误信息
	"log/slog" // 结构化日志，一行一条 JSON
	"os"       // 读文件、退出进程
	"time"     // 设置 RPC 超时

	"github.com/cloudwego/hertz/pkg/app"        // Hertz 的请求/响应载体
	"github.com/cloudwego/hertz/pkg/app/server" // Hertz 服务器
	"github.com/cloudwego/kitex/client"         // Kitex 客户端选项
	"gopkg.in/yaml.v3"                          // YAML 解析

	"github.com/inezhi/dailywork/api/gen/base"                 // 每次 RPC 都要带的公共结构
	"github.com/inezhi/dailywork/api/gen/rpc"                  // Thrift 生成的请求/响应结构
	"github.com/inezhi/dailywork/api/gen/rpc/dailyworkservice" // Thrift 生成的客户端

	"github.com/inezhi/dailywork/services/gateway/internal/adapters/hertz" // HTTP 适配器
)

// YAML顶层结构
type config struct {
	Server serverConfig `yaml:"server"`
	Task   taskConfig   `yaml:"task"`
}

// Hertz配置
type serverConfig struct {
	Addr string `yaml:"addr"` // 监听地址，例如 127.0.0.1:8080
}

// 下游 task 服务的地址
type taskConfig struct {
	Addr string `yaml:"addr"` // RPC 地址，例如 127.0.0.1:8888
}

// 读 YAML 文件，并校验必填项
func loadConfig(path string) (config, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return config{}, fmt.Errorf("read config %s: %w", path, err)
	}

	// &cfg 是取地址：解析函数要往 cfg 里写数据，传值只会改副本
	var cfg config
	err = yaml.Unmarshal(content, &cfg)
	if err != nil {
		return config{}, fmt.Errorf("parse config %s: %w", path, err)
	}

	// 没有监听地址直接报错
	if cfg.Server.Addr == "" {
		return config{}, fmt.Errorf("config %s: server.addr is required", path)
	}
	// 没有下游地址直接报错
	if cfg.Task.Addr == "" {
		return config{}, fmt.Errorf("config %s: task.addr is required", path)
	}

	return cfg, nil
}

// healthCheck 只证明进程还活着，不检查下游。
// Hertz 的处理函数固定是这两个参数：ctx 是上下文，c 装着这次请求和响应。
func healthCheck(ctx context.Context, c *app.RequestContext) {
	// c.JSON 返回 200，并把 map 编码成 JSON 写回去
	c.JSON(200, map[string]string{"status": "ok"})
}

// newTaskClient 创建调用 task 服务的 Kitex 客户端。
// WithHostPorts 直连指定地址；WithRPCTimeout 限制单次调用最长 3 秒。
func newTaskClient(addr string) (dailyworkservice.Client, error) {
	return dailyworkservice.NewClient(
		"DailyWorkService",
		client.WithHostPorts(addr),
		client.WithRPCTimeout(3*time.Second),
	)
}

// 启动时调 Echo，确认 gateway 到 task 服务的链路是通的
func checkTaskRPC(taskClient dailyworkservice.Client) error {
	resp, err := taskClient.Echo(context.Background(), &rpc.EchoReq{
		Message: "gateway-startup",
		Base:    &base.Base{LogId: "gateway-startup", Caller: "gateway"},
	})
	if err != nil {
		return fmt.Errorf("call task echo: %w", err)
	}

	// statusCode 为 0 才算成功；非 0 是服务端返回的业务错误
	if resp.BaseResp.StatusCode != 0 {
		return fmt.Errorf("task echo status=%d message=%s", resp.BaseResp.StatusCode, resp.BaseResp.StatusMessage)
	}

	slog.Info("task rpc ok", "message", resp.Message)
	return nil
}

// run 建客户端、验证下游链路、起 HTTP 服务；返回错误表示启动失败。
func run(cfg config) error {
	taskClient, err := newTaskClient(cfg.Task.Addr)
	if err != nil {
		return fmt.Errorf("new task client: %w", err)
	}

	// 下游不通就不对外提供服务
	err = checkTaskRPC(taskClient)
	if err != nil {
		return err
	}

	// server.Default 创建 Hertz 实例；WithHostPorts 指定监听地址
	hertzServer := server.Default(server.WithHostPorts(cfg.Server.Addr))
	// 把路径 /healthz 和处理函数绑起来
	hertzServer.GET("/healthz", healthCheck)

	// HTTP 路由：请求交给适配器，适配器再调 RPC
	echoHandler := hertz.NewEcho(taskClient)
	hertzServer.POST("/api/v1/echo", echoHandler.Handle)

	slog.Info("gateway listening", "addr", cfg.Server.Addr)
	// Spin 开始收请求，会一直阻塞，进程被杀才退出
	hertzServer.Spin()
	return nil
}

// main 读配置并启动 HTTP 服务。
func main() {
	// -config 指定读取哪个 YAML 文件；flag.String 返回的是指针
	configPath := flag.String("config", "deploy/gateway.yaml", "YAML 配置文件路径")
	flag.Parse()

	logHandler := slog.NewJSONHandler(os.Stdout, nil)
	slog.SetDefault(slog.New(logHandler))

	cfg, err := loadConfig(*configPath)
	if err != nil {
		slog.Error("load config", "err", err)
		os.Exit(1)
	}

	err = run(cfg)
	if err != nil {
		slog.Error("gateway exited", "err", err)
		os.Exit(1)
	}
}
