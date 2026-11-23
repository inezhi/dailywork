// cli 是本地 RPC 服务的命令行客户端：每个接口一个子命令。
// 用法：
//
//	go run ./tools/cli echo "hi"
//	go run ./tools/cli create-task -user u1 -title "测试" -space s1
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/cloudwego/kitex/client"

	"github.com/inezhi/dailywork/api/gen/base"
	"github.com/inezhi/dailywork/api/gen/rpc"
	"github.com/inezhi/dailywork/api/gen/rpc/dailyworkservice"
	"github.com/inezhi/dailywork/api/gen/taskconst"
)

// serviceAddr 是 task 服务的监听地址。
const serviceAddr = "127.0.0.1:8888"

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	svcClient, err := dailyworkservice.NewClient(
		"DailyWorkService",
		client.WithHostPorts(serviceAddr),
	)
	if err != nil {
		log.Fatal("new client: ", err)
	}

	command := os.Args[1]
	commandArgs := os.Args[2:]

	switch command {
	case "echo":
		runEcho(svcClient, commandArgs)
	case "create-task":
		runCreateTask(svcClient, commandArgs)
	default:
		printUsage()
		os.Exit(1)
	}
}

// printUsage 列出支持的子命令。
func printUsage() {
	fmt.Println("用法:")
	fmt.Println("  cli echo \"hi\"")
	fmt.Println("  cli create-task -user u1 -title \"测试\" -space s1 [-project p] [-parent id]")
	fmt.Println("                 [-notes 文本] [-status 1-6] [-priority 1-5]")
	fmt.Println("                 [-scheduled 2026-11-24] [-due 2026-11-30] [-estimate 30]")
}

// runEcho 调用 Echo，把 message 原样返回；没给就用 hello。
func runEcho(svcClient dailyworkservice.Client, args []string) {
	message := "hello"
	if len(args) > 0 {
		message = args[0]
	}

	resp, err := svcClient.Echo(context.Background(), &rpc.EchoReq{
		Message: message,
		Base:    newBase("cli-echo"),
	})
	if err != nil {
		log.Fatal("echo: ", err)
	}
	fmt.Printf("status=%d message=%q\n", resp.BaseResp.StatusCode, resp.Message)
}

// runCreateTask 调用 CreateTask；省略的可选参数不会被发送。
func runCreateTask(svcClient dailyworkservice.Client, args []string) {
	flags := flag.NewFlagSet("create-task", flag.ExitOnError)
	userID := flags.String("user", "u-cli", "用户 id")
	title := flags.String("title", "", "标题，必填")
	spaceID := flags.String("space", "", "空间 id")
	projectID := flags.String("project", "", "项目 id")
	parentID := flags.String("parent", "", "父任务 id")
	notes := flags.String("notes", "", "正文")
	status := flags.Int("status", 0, "状态 1-6；0 表示不传")
	priority := flags.Int("priority", 0, "优先级 1-5；0 表示不传")
	scheduledDate := flags.String("scheduled", "", "计划日期 YYYY-MM-DD")
	dueDate := flags.String("due", "", "截止日期 YYYY-MM-DD")
	estimateMinutes := flags.Int("estimate", -1, "预估分钟；-1 表示不传")
	flags.Parse(args)

	if *title == "" {
		log.Fatal("-title 必填")
	}

	req := &rpc.CreateTaskReq{
		UserId: *userID,
		Title:  *title,
		Base:   newBase("cli-create-task"),
	}
	if *spaceID != "" {
		req.SpaceId = spaceID
	}
	if *projectID != "" {
		req.ProjectId = projectID
	}
	if *parentID != "" {
		req.ParentId = parentID
	}
	if *notes != "" {
		req.Notes = notes
	}
	if *status != 0 {
		value := taskconst.TaskStatus(*status)
		req.Status = &value
	}
	if *priority != 0 {
		value := taskconst.TaskPriority(*priority)
		req.Priority = &value
	}
	if *scheduledDate != "" {
		req.ScheduledDate = scheduledDate
	}
	if *dueDate != "" {
		req.DueDate = dueDate
	}
	if *estimateMinutes >= 0 {
		value := int32(*estimateMinutes)
		req.EstimateMinutes = &value
	}

	resp, err := svcClient.CreateTask(context.Background(), req)
	if err != nil {
		log.Fatal("create-task: ", err)
	}

	if resp.Task == nil {
		fmt.Printf("status=%d message=%q task=nil\n", resp.BaseResp.StatusCode, resp.BaseResp.StatusMessage)
		return
	}
	fmt.Printf("status=%d id=%s version=%d title=%q\n",
		resp.BaseResp.StatusCode, resp.Task.Id, resp.Task.Version, resp.Task.Title)
}

// newBase 构造调用上下文；logId 用来在服务端日志里定位这次调用。
func newBase(logID string) *base.Base {
	return &base.Base{LogId: logID, Caller: "cli"}
}
