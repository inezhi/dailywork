# 开发文档

> 实现相关的一切本地记录。产品规格的正式版本在飞书，这里只做索引、决议和清单。
> 代码 Gate：已开启（2026-11-02，三条判据全部满足）。

## 内容分工

| 内容 | 放哪 | 谁是准 |
|---|---|---|
| 产品范围、API 契约、数据模型 | 飞书 14 篇 | 飞书 |
| 决议记录、文档地图、开 Gate 清单、开发日志 | 本目录 | 本目录（落地后转飞书） |
| DDD 课程 | [`../ddd-course/`](../ddd-course/) | — |
| 代码 | `services/`、`api/`、`deploy/` | 代码 |

不复制飞书正文到本地。复制一份就有两个真相，改了这边忘了那边。

## 本目录

- [decisions.md](decisions.md) — 产品规则决议 D1–D9，含未决项
- [feishu-map.md](feishu-map.md) — 飞书 14 篇的 token、状态、是否阻塞 M1
- [gate-checklist.md](gate-checklist.md) — 开代码 Gate 前的检查清单
- [devlog.md](devlog.md) — 开发过程记录，每次提交前更新

## 当前状态

- 飞书 14 篇全部存在且有完整结构，没有空壳
- 产品规则 5 条（D1–D5）+ 客户端 2 条（D6/D7）+ 部署 2 条（D8/D9）已全部写进飞书
- 术语表 15 条已写进 02 §6.1，Gate 判定第 1 条满足；第 3 条（契约）仍空着
- 客户端形态定为网页端 + macOS 桌面端（Tauri），同一份前端；Windows/移动端后续
- 部署目标：开发 Compose，上线单节点 k3s；入口走 Tailscale tailnet，不开公网端口（M6 不再选做）
- 03 路线图已按垂直切片重写，01 的状态表已同步
- 05/06/07/08/13 已逐条核对验收判据，六篇阻塞 M1 的文档全部定稿（2026-10-31）
- `api/` 已有 Thrift 与 OpenAPI 契约及生成代码；`services/`、`deploy/` 仍不存在

## 下一步

Gate 三条判据已于 2026-11-02 全部满足（见 [gate-checklist.md](gate-checklist.md) H 组），进入代码阶段：

1. `make codegen`：把两条生成命令固化，重跑后 `git diff --exit-code` 必须为空
2. 开发环境：colima + Compose（MySQL 8、Redis、Kafka KRaft）
3. 切片 1：`POST /tasks` → gateway → task → MySQL
