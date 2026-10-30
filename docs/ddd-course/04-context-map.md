# 第 4 课：Context map

> 状态：已讲完
> 外部案例：Segment 的微服务膨胀与回退
> 关键词：上下文地图、上下游、契约、防腐层、共享内核

## 1. 现实问题：两句话里的“任务”不是同一个东西

用户在 assistant 里说：“帮我把周报任务标记完成。”

这句话里有一个词：任务。但它在两个地方的模型不一样。

| | assistant | task |
|---|---|---|
| “任务”是什么 | 对话里的一个引用 | 一个聚合 |
| 有没有 status | 没有 | 有 |
| 能不能判断完成 | 不能 | 能，规则在它手里 |

assistant 不能自己判断这个任务存不存在、是不是已经完成。它必须问 task。

这一次“问”，就是一条线。第 4 课要回答的，就是这条线怎么画：传什么、用什么格式、谁负责翻译。

为什么不能直接读 task 的数据库？因为 task 一改表，assistant 就坏；两个服务共用一个库，边界就没了。

为什么不能复制一份任务表？因为任务状态会变，复制品很快不一致。

## 2. 解决方式：画一条线，只做四步

以 assistant 问 task 为例。

**第一步：找上下文。** 哪些词在哪些范围里只有一个意思。`task` 里的 Task 有状态和规则；assistant 里的“任务”只是对话里的引用。这是两个上下文。

**第二步：找上游。** 谁的模型变了，别人要跟着改，谁就是上游。

- task 的 Task 模型改了，assistant 要跟着改。
- assistant 的 Conversation 模型改了，task 不用改。

所以 task 是上游，assistant 是下游。注意：不是“谁调用谁”。这里 assistant 调用 task，但 assistant 是下游。调用方向是 assistant → task，影响方向是 task → assistant。上下文地图画的是影响方向。

**第三步：定契约。** 这条线传什么，不传什么。

assistant 要判断完成，只需要知道任务存在、状态是什么。不需要截止日期、优先级、父子关系。所以线上传 `taskID` 和 `status`，不传整个 Task。

窄契约不是为了省流量，是为了把依赖控制在少数几个点上。传 20 个字段，下游就有 20 个可能依赖的东西。

**第四步：定翻译。** 谁负责把上游的模型转成自己的说法。

task 把 `title` 改名成 `name` 时，如果 assistant 在 5 个地方直接用 `task.name`，要改 5 处；如果有一个入口统一翻译，只改 1 处。

这个入口就是 ACL（防腐层）。一个上游一个 ACL，不要合并成一个万能翻译层。

## 3. 概念：上下文地图和三种接法

> 上下文地图是一张图，画出有哪些限界上下文，以及它们之间的关系、集成方式。

一条边只有三件事：谁影响谁、传什么、谁翻译。

上游给的东西，下游有三种接法：

| 上游给的东西 | 下游怎么做 | 名字 |
|---|---|---|
| 刚好能用 | 直接用 | Published Language / Conformist |
| 能用但不好用，或者老变 | 自己翻译 | Customer-Supplier + ACL |
| 用不上，或者不需要 | 不接 | Separate Ways |

例子：

- identity → task：JWT 里的 `userID` 刚好能用，直接用。
- identity 的 `roles` 是 `"admin,editor"` 这种字符串，task 要判断能不能删除：能用但不好用，加 ACL，转成 `{ canDelete, canEdit }`。
- task → assistant：assistant 只需要任务引用，自己翻译。
- task → docs：docs 只存 `taskID`，显示时取标题，自己翻译。
- planning → task：现在不需要，先不接。

几个容易混的点：

- **上游不是调用方。** 上游是模型变化会影响别人的一方。
- **ACL 只挡模型，不挡请求。** 请求照样发给 task，只是回来的数据在入口处转换一次。
- **一个上游一个 ACL。** task 的 ACL 和 docs 的 ACL 分开，因为它们接的是不同的模型，变化节奏也不同。

## 4. 理论：共享内核是一个警告

还有第四种情况：两个上下文共享代码或表。它不叫接法，叫 Shared Kernel（共享内核）。

Segment（现在是 Twilio Segment）的案例：

- 数据管道长到 140 多个微服务，基本一个目的地一个服务，每月新增约 3 个。
- 为了复用，抽了共享库：字段转换、HTTP 处理。
- 改一个共享库，要测试、部署几十个服务。
- 赶时间时只在一个服务里升级，版本逐渐分叉，行为不一致。
- 运维成本线性增长，3 个全职工程师大部分时间在维持系统；交付变慢，缺陷率上升。
- 最后合并回一个服务、一个 monorepo，统一 120 个依赖的版本，共享库改进从一年 32 次提高到 46 次。代价是故障隔离变弱、缓存效率下降。

教训不是“都该合并”，而是：

- 共享代码不是免费的，它本身就是一条线：改了，所有消费者都要跟着改。
- 共享之前先问：改了以后，谁要跟着改？超过一个团队，就别共享。
- 共享的那块越小越好，并且要有人负责、要版本化。

共享数据库是更糟的 Shared Kernel：它把 schema、事务、发布周期绑在一起，一个上下文改表，另一个上下文就坏。所以共享数据库不算集成方式。

## 5. 闭环：我们项目的 context map

```text
identity --JWT--> task / gateway / docs / assistant
task --task API--> assistant（ACL）
task --task API--> docs（ACL）
task --Kafka task.events.v1--> gateway / 其他消费者
planning --?--> task（先不接）
```

| 上游 | 下游 | 接法 | 集成方式 | 共享什么 |
|---|---|---|---|---|
| `identity` | `task`、`gateway`、`docs`、`assistant` | 直接用 | JWT claims | `userID` 等 claims |
| `task` | `assistant` | ACL | task API（Kitex） | `taskID`、`title`、`status` |
| `task` | `docs` | ACL | task API（Kitex） | `taskID`、`title` |
| `task` | SSE、notification、analytics | 直接用 | Kafka `task.events.v1` | 事件 schema |
| `task` | `planning`（后续） | 先不接 | — | — |

几条硬规则：

- 服务之间不共享数据库、不共享表；跨服务只走 API 或事件。
- 不共享领域模型；共享的只有契约：Thrift、OpenAPI、事件 JSON Schema，以及 ID。
- `gateway` 是集成层，不是上下文；它做协议转换、鉴权、限流，不做任务状态机。
- `assistant`、`docs` 用 `taskID` 调 task API；可以存快照，但快照不是权威数据。

一句话总结第 4 课：

> 先看谁影响谁（上下游），再看上游给的东西好不好用，最后决定：直接接、自己翻译，还是不接。共享代码或表，是第四种情况，要当成依赖来管。

## 检查题

1. `assistant` 调 `task` 完成任务。谁是上游？为什么不是“谁调用谁谁就是上游”？
2. 下面四条线，各选一种接法，并说一句理由：identity → task、task → assistant、task → docs、planning → task。
3. Segment 的共享库属于哪种情况？它错在哪：共享本身，还是共享的方式？

## 本课总结

- 上下文地图画的是上下文之间的关系：谁影响谁、传什么、谁翻译。
- 上游由影响方向决定，不由调用方向决定。
- 上游给的东西刚好能用就直接用；不好用或老变就加 ACL；用不上就不接。
- 共享代码或共享表是第四种情况，它让两边一起变；共享之前先问谁会跟着改。
- 一个上游一个 ACL；窄契约把依赖控制在少数几个点上。

**关键词**：上下文地图、上下游、契约、防腐层、共享内核。

## 来源

- [Twilio Segment: Goodbye Microservices](https://www.twilio.com/en-us/blog/developers/best-practices/goodbye-microservices)
- [Martin Fowler: Bounded Context](https://martinfowler.com/bliki/BoundedContext.html)
- [Domain Language: DDD Reference](https://www.domainlanguage.com/ddd/reference/)
