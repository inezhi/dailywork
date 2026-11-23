# 本地调用 RPC 接口

> 用途：不经过 gateway，直接从命令行调 task 服务的接口。
> 源码：[`tools/cli/main.go`](../../tools/cli/main.go)；每个接口一个子命令。

## 前提

服务在 `127.0.0.1:8888` 上运行：

```bash
colima start
make up
go run ./services/task/cmd/task -config deploy/task.yaml
```

所有命令都在仓库根目录执行，`go run` 需要 `go.mod`：

```bash
cd /Users/lingzhi/Documents/project/dailywork
```

## Echo

```bash
go run ./tools/cli echo "你好"
```

不传参数时默认 `hello`：

```bash
go run ./tools/cli echo
```

输出：

```
status=0 message="你好"
```

## CreateTask

最少参数（`-title` 必填，`-space` 不传会返回 400「缺少空间」）：

```bash
go run ./tools/cli create-task -title "测试任务" -space s1
```

全部参数：

```bash
go run ./tools/cli create-task -user u1 -title "写周报" -space s1 -project p1 -notes "本周总结" -status 2 -priority 4 -scheduled 2026-11-24 -due 2026-11-30 -estimate 45
```

建子任务（带 `-parent` 时会继承父任务的空间与项目）：

```bash
go run ./tools/cli create-task -title "子任务" -parent 82ebba38-f108-4ad3-a0d0-d1f12c4b55b3
```

输出：

```
status=0 id=82ebba38-... version=1 title="写周报"
```

### 参数

| 参数 | 必填 | 说明 |
|---|---|---|
| `-title` | 是 | 空标题会返回 400 |
| `-user` | 否 | 默认 `u-cli` |
| `-space` | 否 | 空间 id；当前实现要求必填 |
| `-project` | 否 | 项目 id；不传就不发送 |
| `-parent` | 否 | 父任务 id；只允许一层 |
| `-notes` | 否 | 正文 |
| `-status` | 否 | 1=inbox 2=next 3=doing 4=waiting 5=blocked 6=done |
| `-priority` | 否 | 1=none 2=low 3=medium 4=high 5=urgent |
| `-scheduled` | 否 | 计划日期 `YYYY-MM-DD` |
| `-due` | 否 | 截止日期 `YYYY-MM-DD` |
| `-estimate` | 否 | 预估分钟数 |

可选参数是**不传就不发送**，服务端按自己的默认值处理。

## 返回码

`status` 就是 `BaseResp.statusCode`：

| status | 含义 |
|---|---|
| 0 | 成功 |
| 400 | 校验失败，`message` 里是原因 |
| 404 | 找不到 |
| 409 | 版本冲突 |
| 500 | 服务端错误 |

## 加一个新接口

1. 在 `tools/cli/main.go` 的 `switch` 里加一个 `case`
2. 照 `runCreateTask` 写一个 `runXxx` 函数，用 `api/gen` 里的类型构造请求

接口实现之前，先改 `api/thrift/v1/dailywork.thrift` 并跑 `make codegen`。

## 为什么不能 curl

Kitex 走 Thrift 二进制 TCP 协议，不是 HTTP。gateway 写出来之后，对外的 `POST /api/v1/tasks` 才能用 curl 调。
