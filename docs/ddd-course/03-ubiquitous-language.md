# 第 3 课：通用语言

> 状态：已讲完
> 外部案例：Slack 的 Conversations API
> 关键词：通用语言、术语表、语言一致性、翻译成本、上下文边界

## 1. 现实问题：一个“频道”，四套 API

Slack 是聊天工具。用户在界面上看到的是：

- 公开频道（public channel）
- 私有频道（private channel）
- 私信（direct message，DM）
- 多人私信（group DM）
- 后来还有共享频道（shared channel）

但在给开发者用的 Web API 里，这些东西被拆成了四套方法：

| 用户看到的 | 旧 API |
|---|---|
| 公开频道 | `channels.*` |
| 私有频道 | `groups.*` |
| 私信 | `im.*` |
| 多人私信 | `mpim.*` |

每套方法有自己的参数、返回结构、OAuth scope。开发者想“列出这个用户能看到的所有会话”，要调四个接口，处理四种返回，申请四种权限。

更麻烦的是名字对不上：

- 产品里叫 **private channel**，API 里叫 **group**。新开发者看到 `groups.list`，第一反应会是“用户组”，而不是“私有频道”。
- 产品里叫 **DM**，API 里叫 **im**；**group DM** 叫 **mpim**。

开发者必须在脑子里做一次翻译：产品词 → API 词 → scope → 返回结构。

这还不是最危险的。要知道一个 ID 是什么类型，开发者常常看 ID 前缀：`C` 是频道，`G` 是私有频道/群组，`D` 是私信。前缀不是契约，只是实现细节，但大家把它当成了类型判断依据。

后来 Slack 推出共享频道：一个频道可以跨工作区共享，对某个团队是私有，对另一个团队是公开。Slack 把共享频道并进了公开频道表，好让同一个频道 ID 在不同工作区通用。结果：

- 频道 ID 的前缀可能变化，比如 `G...` 变成 `C...`，靠前缀猜类型的代码就错了。
- 权限也出问题：一个只有 `channels:read` 权限的应用，可能因为共享频道在公开频道表里，拿到本来不该看的私有共享频道。

这不是“API 设计得不好看”，而是**代码里的词和业务里的词对不上**：模型按数据库表分，不按业务概念分；类型藏在 ID 前缀里，不放在模型里。每多一个调用方，就多一次翻译；翻译错了，就是 bug。

Slack 的文档后来用一句话概括了新的模型：

> A conversation object contains information about a channel-like thing in Slack.

“channel-like thing”这个说法本身就说明：这类东西需要一个共同的上位词。

## 2. 解决方式：用一个领域词，把区别变成属性

Slack 没有继续加第五套 API，而是把四套合成一套：

- 一个方法族：`conversations.*`，覆盖公开频道、私有频道、私信、多人私信、共享频道。
- 类型不再靠 ID 前缀猜，而是显式字段：`is_channel`、`is_private`、`is_im`、`is_mpim`、`is_shared`、`is_ext_shared`。
- 一套参数、一套分页、一套返回结构。
- scope 变成过滤器：`conversations.list` 接受 `channels:read`、`groups:read`、`im:read`、`mpim:read`，只返回 token 有权限看的内容。

旧方法从 2020 年 6 月 10 日起对新应用关闭，2021 年 2 月 24 日对老应用移除。这不是一次改名，而是模型换了。

关键变化不是“conversation 这个词更好听”，而是：

- 模型按业务概念组织：conversation 是一类东西，公开/私有/私信/共享是它的属性。
- 类型是显式的，不再藏在 ID 前缀里。
- 代码、文档、API 用同一套词；开发者不需要先学“group 其实是 private channel”。

一个细节：用户仍然会说 channel 或 DM，不一定会说 conversation。通用语言不要求所有人嘴上说同一个词；它要求团队对模型里的词有共同、精确的定义，并且在代码、文档、测试里一致使用。Slack 用 conversation 做上位词，用 flags 表达区别；用户的产品词汇没有被消灭，只是不再和代码词汇打架。

## 3. 概念：通用语言

> 通用语言是团队（业务专家 + 开发）在同一个限界上下文里共同使用的一套精确词汇：同一个词只有一个含义，并且同时出现在对话、文档、代码、测试和界面里。

四个要点：

- **不只是命名统一。** 名词、动词、状态、规则、事件都要对齐。比如 `done` 是状态，`Complete` 是动作，`completedAt` 是结果；三者不能混着叫。
- **不只属于开发。** 业务专家必须使用这套词，并能纠正开发的理解；如果只有代码里用，它就不是通用语言，只是命名规范。
- **只在上下文内通用。** 出了限界上下文，同一个词可以有别的含义（第 2 课）。通用语言不是全公司一张大词典。
- **它是活的。** 业务变了，语言要跟着变；改词的时候，代码、文档、测试、契约一起改，不能只改文档。

它不是什么：

- 不是贴在墙上、没人使用的术语表。
- 不是把所有同义词强行消灭；是让每个词在上下文内有精确含义。
- 不是英文命名规范；中英文都可以，关键是团队和代码一致。
- 不是一次命名会；是持续的对话、修正和落地。

## 4. 理论：语言、模型、代码三者对齐

- **语言是模型的入口。** 业务专家说不出模型里的词，模型就偏了；开发听不懂业务专家的词，代码就偏了。
- **模型是语言的骨架。** 不是每个词都要建类，但关键名词、动词、状态、规则要有明确位置。
- **代码是语言的落地。** 类名、方法名、事件名、测试名、错误码都用同一套词。
- 三者不一致时，翻译成本会出现在每个调用方。翻译多了，就会有人猜；猜错，就变成 bug。
- Slack 的例子：产品说 private channel，API 说 group；类型藏在 ID 前缀里。共享频道一改，翻译和猜测一起失效。
- 通用语言和限界上下文的关系：上下文边界也是语言边界。边界内一种语言；跨边界要翻译，不能假设同名同义。
- 术语表由谁维护：业务专家和开发共同维护。一个人项目里，你就是两边，但更要把词写下来、用在代码和测试里；否则它只是一份没人执行的文档。

## 5. 闭环：我们项目的术语表

| 术语 | 含义 | 所属上下文 | 不叫什么 |
|---|---|---|---|
| Space | 最上层的工作空间，隔离项目、任务、标签 | task | workspace、team |
| Project | 空间内的一组任务容器，可归档 | task | folder、list |
| Task | 有状态机、完成时间、父子关系的工作项 | task | todo、issue、ticket |
| Subtask | 通过 `parentID` 指向父任务的 Task，不是另一种类型 | task | child issue、sub-item |
| Today | 按日期查询任务的视图，不是一种状态 | task | today list（当成实体） |
| Status | 任务状态：inbox、next、doing、waiting、blocked、done | task | state、stage |
| Priority | 优先级：none、low、medium、high、urgent | task | importance |
| Complete | 活跃状态 → done，写 `completedAt` | task | finish、close |
| Reopen | done → doing，清空 `completedAt` | task | reopen issue |
| Archive | 项目归档，不是删除 | task | delete |

几条使用规则：

- 在 `task` 上下文里，统一说 **Task**，不用 Todo、Issue、Ticket。PRD、代码、测试、事件名都用 Task。
- `done` 是状态值，`Complete` 是动作，`completedAt` 是结果；不要用 `finished`、`closed` 混着表示。
- `Today` 是查询视图，不是任务的一种状态；不要把它做成 `status = today`。
- `Subtask` 不是新类型，是带 `parentID` 的 Task；不要建一套平行的 ChildTask 模型。
- `Archive` 只用于项目；任务用软删除，不叫 archive。
- 在 `assistant` 上下文里，用户说“任务”可能只是对话里的一件事；它不是 Task 聚合。要操作任务，仍然通过 task API，用 `taskID` 引用。
- 在 `docs` 上下文里，文档里的一行待办文本不是 Task；要关联任务，只存 `taskID`。

术语表怎么维护：

- 每个词写四件事：含义、所属上下文、不叫什么、一个例子。
- 术语表要进代码：类名、方法名、事件名、错误码、测试名都用它。
- 改术语等于改模型：代码、文档、测试、API 契约一起改；不能只改文档。
- 代码评审时检查用词；发现同义词混用，先统一，再继续写。
- 一个人项目也要写下来；否则过几周，你自己也会用回 Todo、Issue、Item 这些词。

## 检查题

1. Slack 的旧 API 里，产品叫 “private channel”，代码叫 `groups`；产品叫 “DM”，代码叫 `im`。这种不一致会带来哪些具体成本？为什么把类型藏在 ID 前缀里更危险？
2. 我们项目里，`Task`、`Todo`、`Issue` 这三个词应该怎么处理？术语表应该由谁维护，怎么保证它不只是文档？

## 本课总结

- 通用语言是同一上下文内，业务和开发共用的一套精确词汇；它同时存在于对话、文档、代码和测试里。
- 它不只是命名统一：名词、动词、状态、规则、事件都要对齐。
- Slack 的案例：产品说 private channel，API 说 group；四套 API 和 ID 前缀猜测让每个调用方都付翻译成本，共享频道一出现就失效。
- 语言、模型、代码三者不一致时，翻译会变成猜测，猜测会变成 bug。
- 通用语言只在上下文内通用；术语表由业务和开发共同维护，并且必须写进代码和测试。

**关键词**：通用语言、术语表、语言一致性、翻译成本、上下文边界。

## 来源

- [Slack Engineering: Evolving the Slack API](https://slack.engineering/evolving-the-slack-api/)
- [Slack Docs: Using the Conversations API](https://docs.slack.dev/apis/web-api/using-the-conversations-api)
- [Slack Docs: Conversation object](https://docs.slack.dev/reference/objects/conversation-object)
- [Slack Changelog: More reasons to be a conversations API convert](https://docs.slack.dev/changelog/2018/09/01/more-reasons-to-be-a-conversations-api-convert)
