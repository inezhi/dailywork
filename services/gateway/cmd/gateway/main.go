// gateway 入口：读配置、起 Hertz HTTP 服务。
package main

import (
	"context"  // 请求上下文，用来传超时和取消信号
	"flag"     // 解析 -config 这类命令行参数
	"fmt"      // 拼错误信息
	"log/slog" // 结构化日志，一行一条 JSON
	"os"       // 读文件、退出进程

	"github.com/cloudwego/hertz/pkg/app"        // Hertz 的请求/响应载体
	"github.com/cloudwego/hertz/pkg/app/server" // Hertz 服务器
	"gopkg.in/yaml.v3"                          // YAML 解析
)

// config 对应 YAML 的顶层结构。
type config struct {
	Server serverConfig `yaml:"server"` // 反引号里是 tag，告诉 YAML 库这段叫 server
}

// serverConfig 是 Hertz 的监听配置。
type serverConfig struct {
	Addr string `yaml:"addr"` // 监听地址，例如 127.0.0.1:8080
}

// loadConfig 读 YAML 文件，并校验必填项。
func loadConfig(path string) (config, error) {
	// 整个文件读成字节，交给 YAML 库解析
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

	// 没有监听地址就起不来，直接报错
	if cfg.Server.Addr == "" {
		return config{}, fmt.Errorf("config %s: server.addr is required", path)
	}

	return cfg, nil
}

// healthCheck 只证明进程还活着，不检查下游。
// Hertz 的处理函数固定是这两个参数：ctx 是上下文，c 装着这次请求和响应。
func healthCheck(ctx context.Context, c *app.RequestContext) {
	// c.JSON 返回 200，并把 map 编码成 JSON 写回去
	c.JSON(200, map[string]string{"status": "ok"})
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

	// server.Default 创建 Hertz 实例；WithHostPorts 指定监听地址
	hertzServer := server.Default(server.WithHostPorts(cfg.Server.Addr))
	// 把路径 /healthz 和处理函数绑起来
	hertzServer.GET("/healthz", healthCheck)

	slog.Info("gateway listening", "addr", cfg.Server.Addr)
	// Spin 开始收请求，会一直阻塞，进程被杀才退出
	hertzServer.Spin()
}
