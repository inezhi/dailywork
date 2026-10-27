# AI 集成与护栏

更新：2026-10-27 · 飞书归档：[09 AI 与安全](https://my.feishu.cn/docx/RUX7dI7mCokzm3xhWgBcZcMGnlg)

## 供应商

- 默认 DeepSeek：`https://api.deepseek.com`，模型 `deepseek-chat` / `deepseek-reasoner`。
- 任意 OpenAI 兼容端点：Base URL + 模型 + Key；不内置模型推理。
- 设置页保存供应商；同一时间一个默认供应商。Key 用 AES-256-GCM 加密（`secrets.key` 0600），API 只返回 `hasKey`。
- 连通性测试：发送一次最小 chat 请求，返回 HTTP 状态与延迟。

## 对话

- 表：`ai_conversations`、`ai_messages`。每次请求保存用户消息与最终助手消息；历史取最近 30 条。
- 系统提示包含：当前日期、工作原则（不编造、先查工具、变更需授权、破坏性不自动确认、回答简短）、上下文（任务/项目/文档/周复盘，截断 2–5k 字符）。
- 工具循环最多 5 轮；上下文与工具结果超长截断（6000 字符）。

## 工具与护栏

| 场景 | 行为 |
|---|---|
| 只读 op（task.list、today.get…） | 自动执行，结果回填 |
| 非破坏性 command | 仅当 `confirmTools=true`（界面「允许执行变更」）执行；否则返回 `CONFIRM_REQUIRED` |
| 破坏性 op（delete 等） | 永不自动执行，返回 `CONFIRM_REQUIRED`，由用户手动完成 |
| 未知工具 / 参数 JSON 错误 | 返回错误给模型，不中断对话 |
| AI 关闭 | `AI_DISABLED`，UI 引导设置 |
| 未配置供应商 | UI 空状态跳转设置 |

所有 AI 执行的命令写入 `op_log`，`actor=ai`、`source=ai`；工具轨迹在回复下方展示。

## 数据与隐私

- 数据只在用户请求时发送到用户配置的模型供应商；无遥测、无代理。
- 日志不含对话内容（只记录 HTTP 状态与耗时）；对话正文在 SQLite。
- 后续：按空间/项目禁用 AI、对话导出与删除、流式取消。

## 失败与超时

- 模型请求 90 秒超时（AbortSignal）；HTTP 非 2xx 转 `UPSTREAM_ERROR`，UI 显示错误气泡。
- 失败不会写入助手消息；用户可重试。
- 工具部分失败时，模型仍可生成说明性回复；失败 chip 标注。
