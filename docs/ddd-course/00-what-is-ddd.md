# 第 0 课：为什么需要 DDD

> 状态：已讲完
> 外部案例：Jira 的 Status 与 Resolution
> 关键词：规则归属、聚合、不变量

## 1. 现实问题：一个 Done 的 issue，为什么报表说没解决

Jira 是很多公司用来记 bug 和任务的工具。每条记录叫一个 issue，可以理解成一张工单：

> 登录按钮点了没反应

工单上有很多字段，其中两个容易混：

| 字段 | 含义 | 例子 |
|---|---|---|
| Status | 现在到哪一步了 | To Do、In Progress、Done |
| Resolution | 为什么结束 | Fixed、Won't Do、Duplicate |

真实发生的情况是：

1. 一个开发把这张工单拖到 **Done**
2. 他没有填 **Resolution**
3. 看板上显示 Done
4. 报表却把它算作 Unresolved
5. 发布说明或统计里可能漏掉它

用一张图表示：

```text
看板：  Done
报表：  Unresolved
原因：  Resolution 为空
```

于是团队看到两个数字：看板说完成了 10 个，报表说只解决了 7 个。大家开始争论谁对。

这不是 Jira 坏了，而是**同一条规则没有统一入口**。每个页面、报表、自动化都按自己的理解读字段，最后就会出现两套事实。

## 2. 解决方式：把规则收进一个入口

规则只有一句：

> Status 变成 Done 时，Resolution 必须有值；重新打开时，Resolution 要清空。

问题不是规则难，而是规则放在哪。

如果每个报表都自己判断一次，就会有三套口径；如果每个页面、导入脚本、自动化都自己写 `status = done`，迟早有人漏掉 Resolution。

更稳的做法是：把这条规则放进一个统一行为里：

- `Resolve(resolution)`：同时改 Status、Resolution 和解决时间
- `Reopen()`：把 Status 改回去，并清空 Resolution

外部只能通过这个行为改状态，不能各自拼字段。

## 3. 概念：聚合与不变量

从上面的解决方案里，抽出两个词。

### 聚合

一组必须一起保持正确的数据，叫**聚合**。

在 Jira 这个例子里，Status、Resolution、解决时间不是三个互不相关的东西；它们要一起变。可以把它看成一张工单这一组数据。

### 不变量

任何时候都不能被破坏的规则，叫**不变量**。

“Status = Done 时 Resolution 不能为空”就是一条不变量。

不变量应该由聚合的**行为**守住，而不是让每个报表自己判断。这也是为什么 `Resolve()` 比“每个页面自己改 status”更稳。

## 4. 理论：DDD 到底在做什么

DDD 不是框架，不是目录结构，也不是微服务。

它首先在回答三个问题：

1. 这条业务规则是什么？
2. 这条规则归谁管？
3. 这条规则在哪一层执行？

DDD 通常分三层看：

| 层 | 回答什么 | 例子 |
|---|---|---|
| 战略设计 | 边界画在哪 | 哪些业务放在一个上下文，哪些要拆开 |
| 战术设计 | 边界内怎么建模 | 聚合、实体、值对象、领域事件、repository |
| 应用层 | 一次操作怎么完成 | 用例、事务边界、跨聚合编排 |

Jira 这个案例落在**战术设计**：Status 和 Resolution 必须一起成立，所以规则要由工单这一组数据的行为守住。

DDD 的目标不是多画几张卡，而是让同一条规则不在 UI、报表、定时任务里各写一遍。

## 5. 闭环：映射到我们的 Task

我们的 Task 也有类似的一对字段：

- `status = done`
- `completedAt`

它们必须同时成立：

- `Task.Complete()` 同时写 `status` 和 `completedAt`
- `Task.Reopen()` 清空 `completedAt`
- 如果以后有人写一个导入脚本，只改 `status` 不改 `completedAt`，这条不变量就会被破坏

这就是为什么规则要有归属，而不是散落在每个调用方。

## 检查题

1. 一个 issue 在看板上是 Done，但报表说它未解决，最可能是哪个字段为空？
2. 要避免这种矛盾，规则应该放在每个报表里，还是放在进入 Done 的那个统一入口？为什么？

答完这两题，再进第 1 课：子域。

## 本课总结

- DDD 不是框架，也不是微服务；核心是规则、归属、边界和语言。
- Jira 案例说明：Status 与 Resolution 必须一起成立，规则要放进统一行为。
- 这种“必须一起成立”的规则叫聚合内不变量，由聚合行为守住。
- 映射到 Task：`Complete()` 同时写 `status` 和 `completedAt`，`Reopen()` 清空。
- 下一课：子域，回答“哪些业务是核心，哪些是通用能力”。

**关键词**：DDD、规则归属、聚合、聚合内不变量、边界。

## 来源

- [Atlassian KB: Missing Done Issues in Advanced Roadmaps](https://support.atlassian.com/advanced-roadmaps-for-jira/kb/missing-done-issues-in-advanced-roadmaps-plan-jira-data-center/)
- [Atlassian: Configure resolutions in a Jira workflow](https://support.atlassian.com/jira-cloud-administration/docs/configure-resolutions-in-a-jira-workflow/)
