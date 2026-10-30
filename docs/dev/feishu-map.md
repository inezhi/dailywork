# 飞书文档地图

> 知识库根节点：[开发](https://my.feishu.cn/wiki/HjuOwAe34iZPbmkzOJhcMYK1nb4)
> `space_id`：`7539901883252539394`
> 核对时间：2026-10-31

## 用途

- 找文档：直接用 obj_token 调 `lark-cli docs +fetch`
- 判断 M1 能不能开工：看"阻塞 M1"列
- 改文档前确认改的是哪一篇，别改到同名节点

## 十四篇

| # | 标题 | node_token | obj_token | 阻塞 M1 |
|---|---|---|---|---|
| 01 | 项目总览 | `ALRjwaoJxi88NNk7ttMca03cnEf` | `FLJ7dgIJCoU7mxxZqSjcp0m9nye` | 否 |
| 02 | 产品需求文档（PRD） | `VBjjw4UdfisQpnk8YrZcesHLnvg` | `QprvdtuRPoDIfIxkAqAcjHWSncd` | **是** |
| 03 | 产品路线图与迭代计划 | `EpqawRh7din22ykpkXocPu17n5d` | `B664d9h3YoaYL4x1r4kcLuCjnCe` | 否 |
| 04 | 微服务架构总览 | `LrvQw8IlDiGKxSkw8SoceIsunWb` | `RXNhd8p0IobTVQxTjgscCYbMnlb` | 否 |
| 05 | 服务边界与数据归属 | `AmXswneqTiE6aZklphTcGHqAnle` | `M7PDdxywCoxjKQxjrwvctmUunPd` | **是** |
| 06 | 数据模型与一致性 | `LM7bwpqfjiHdF7kAUxpczJ7qnkh` | `Ox4qdSMrKo6OxtxwNNscr8SanGh` | **是** |
| 07 | API 契约与网关 | `LcvjwjRJ9iVboYkNvucclMnWnEd` | `Ld5Sdg2F3ohjC9xiWnZcYhYbn4c` | **是** |
| 08 | 事件驱动与消息 | `TbDcw8OwTiR4T1kpcvFc56Eqnze` | `PzondBBrHowGAExImTXc11jqnUb` | **是** |
| 09 | 安全与账户体系 | `ZmTDwwY03iUAq1kjzolcKDuun0c` | `RUX7dI7mCokzm3xhWgBcZcMGnlg` | 否 |
| 10 | 可观测性与运维 | `KCMuwU3aWivkUKkVXzxcUT37n4g` | `AKDod7oQdorRSoxT31Wcu5z1nMf` | 否 |
| 11 | 测试策略 | `NL76wH41OihPOGkFF6ocBrzQnTd` | `LFrpdtfHMonOEAxNGexc4kwDnfe` | 否 |
| 12 | 设计系统与页面规格 | `M2NZwqil8iJ5WKkvp74cnMqpnZx` | `R43sdlwRmo2ZBmxGopacAjfrnrd` | 否 |
| 13 | ADR 决策记录 | `NJr6wRyuTiMzeEkHu79c8hoCnNg` | `VnGbdOi8aoyCG5xuohZcxZq9nAb` | **是** |
| 14 | 研发流程与发布 | `CtWjwAwCwiYLIJkdPPPciEuDnbr` | `ArcAdEWEyoU3PzxGwxgc2EJhnQg` | 否 |

## 当前状态（已核对）

14 篇全部存在，都是 docx，都有完整结构，结尾都有"验收标准"和"待决问题"。
没有空壳占位。

2026-10-31 的改动：

- **03 路线图整篇重写**：从"先搭三服务骨架、再按层补功能"改成垂直切片，M1 = 四刀。
- 01 状态表、02 产品规则、07 `cascade`、08 扇出规则、13 ADR-0018 同步更新。
- 04/05/06/09/10/11/12 里引用旧里程碑编号的地方一并对齐。
- 02 非目标里误列的 Kafka 删掉（Kafka 是核心组件，不是非目标）。
- **05/06 逐段核对**：05 的时序画板补上 outbox + relay；06 修了今天查询的三处问题、
  加了 `chk_tasks_done` 约束、子任务规则改为二次确认 + 事件驱动。
- **06 加两张 ER 画板**：identity 库（users / sessions / login_attempts）和
  task 库（spaces / projects / tasks / tags / task_tags），Mermaid 原生画板。
  outbox 和 idempotency_keys 没有外键，不画进 ER，在第 8 节单独说明。
- **客户端范围改为网页端 + macOS 桌面端**：01 §4.1/§4.3、02 §4 与新增 FR-C1、
  03 M4、04 §2/§9、12 §6.8、13 ADR-0019。Windows/Android/iOS 退出非目标。
- **桌面端登录态**：09 §5.1 新增桌面端凭证，信任边界画板改为双客户端；
  07 §1 认证约定与 login/register/logout 三行；13 ADR-0020。
- 14 §7 增加桌面端发版与 `X-Client-Version`；03/13 待决问题各补一条。
- **部署目标定为公网服务器 + 单节点 k3s**：01 运行环境、03 M6 整节重写（不再选做）、
  04 §7 部署拓扑、09 公网要求、10 集群指标、13 ADR-0021/0022、14 环境表与发布流程。
- **访问入口改为 Tailscale（同日修正）**：确认手上只有第三方 FRP 的随机端口、域名不受控，
  公网 443 + cert-manager 的前提不成立。改 01 状态表、03 M6、04 §6/§7/§9、09 §1/§10/§12、
  13 新增 ADR-0023（ADR-0022 标记为被取代）、14 环境表与发布检查单。

已逐篇读过正文的：

- **02 PRD**：完整。有用户故事、5.x 功能需求（任务/今天/实时更新/设置）、
  字段规则表、非目标、指标、依赖与风险。FR 编号连续，每条带验收描述。
- **06 数据模型**：有 MySQL DDL。
- **05 / 07 / 08 / 13**：读过大纲结构，未逐段核对。

关键内容摘录：

- FR-D1：今天页由客户端传 `YYYY-MM-DD`，服务端不推导
- FR-D2：今天页六个分组，同一任务只进优先级最高的一组
- FR-T4：子任务只允许一层；子任务继承父任务的空间与项目
- FR-T5：`version` + `expectedVersion`，冲突返回 `409 VERSION_CONFLICT`
- FR-T6：写操作支持 `Idempotency-Key`
- FR-C1：网页端 + macOS 桌面端（Tauri 外壳），共用一份前端；桌面端 token 存 Keychain

## 已知缺口

2026-10-31 已补，全部写进飞书：

| 缺口 | 补在哪 |
|---|---|
| 完成父任务是否联动子任务 | 02 PRD FR-T3；07 契约 `cascade`；08 扇出规则 |
| 删除父任务"（需确认）"措辞 | 02 PRD FR-T4 |
| 重复任务不在 PRD 也没进非目标 | 02 PRD 非目标（同时把误列的 Kafka 删掉） |
| 归档项目下的任务是否进今天 | 02 PRD FR-T7 |
| 今天分组第 4 条的"前两组"笔误 | 02 PRD FR-D2，改为"前三组" |
| 路线图按层搭骨架 | 03 整篇重写为垂直切片 |
| 客户端只要 React SPA，没定义桌面端 | 01/02/03/04/12/13 写入网页端 + macOS 桌面端（Tauri） |
| 桌面端跨源 Cookie 没答案 | 09 §5.1、07 §1、ADR-0020 定为 Bearer + Keychain |
| 部署到哪、怎么编排没写 | 03 M6、04 §7、13 ADR-0021/0022 定为服务器单节点 k3s |
| 端口与域名受限，公网入口不成立 | 13 ADR-0023、04 §7、09 §1、03 M6、14 环境表改为 tailnet 入口 |

## 怎么读

```bash
# 看大纲
lark-cli docs +fetch --doc <obj_token> --scope outline --as user

# 全文
lark-cli docs +fetch --doc <obj_token> --scope full --doc-format markdown --as user

# 找关键词
lark-cli docs +fetch --doc <obj_token> --scope keyword --keyword "今天" --doc-format markdown --as user
```

改文档用 `lark-cli docs +update`，保留原 URL。
