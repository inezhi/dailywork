# Ops 操作目录

更新：2026-10-27 · 飞书归档：[08 操作目录](https://my.feishu.cn/docx/PzondBBrHowGAExImTXc11jqnUb)

## 1. 设计

一套操作描述符同时生成四个表面：

```ts
defineOp({
  name: 'task.complete',
  version: 1,
  kind: 'command',
  summary: '把任务标记为完成',
  input: TaskRefInput,                 // zod
  exposure: { http: true, cli: ['task','complete'], mcp: true, ai: true },
  annotations: { idempotent: true },
  errors: ['NOT_FOUND', 'VERSION_CONFLICT'],
  aggregate: 'task',
  handler: (ctx, input) => completeTask(ctx, input),
})
```

| 表面 | 形态 |
|---|---|
| HTTP | `POST /api/ops/<name>`，body 为输入对象；返回统一信封 |
| CLI | `daily <cli path> [位置参数] [--flags] --json` |
| MCP | `daily mcp serve`，工具名 `task_complete`，带 readOnly / destructive 注解 |
| AI | `ai.chat` 工具循环使用相同 JSON Schema；只读自动执行、变更受开关约束 |

## 2. 信封

```json
{
  "ok": true,
  "data": { "id": "tsk_…", "title": "…" },
  "meta": { "opId": "op_…", "version": 1, "durationMs": 3 }
}
```

失败：

```json
{
  "ok": false,
  "error": { "code": "VALIDATION_ERROR", "message": "输入参数校验失败", "details": [...] },
  "meta": { "opId": "op_…", "version": 1 }
}
```

| 错误码 | HTTP | CLI 退出码 |
|---|---|---|
| `VALIDATION_ERROR` / `BAD_REQUEST` | 422 / 400 | 2 |
| `UNAUTHORIZED` | 401 | 2 |
| `NOT_FOUND` | 404 | 3 |
| `VERSION_CONFLICT` / `CONFLICT` | 409 | 4 |
| `CONFIRM_REQUIRED` | 428 | 5 |
| `AI_DISABLED` | 503 | 1 |
| `UPSTREAM_ERROR` | 502 | 1 |
| `INTERNAL` | 500 | 1 |

## 3. 幂等与并发

- 每个 command 输入可带 `opId`（≤64 字符）；服务端缺省生成 `op_…`。
- `op_log.op_id` 唯一；重复请求读取 `after_json` 直接返回，不重复执行副作用。
- `task.update/move/complete` 支持 `expectedVersion`；不匹配返回 `VERSION_CONFLICT` 与 `{expected, actual}`。
- 删除类 op 同样写 `op_log`，`after_json` 保留完整快照，供审计与后续撤销功能使用。

## 4. 确认

- `annotations.destructive` + `confirm: true` 的 op 在 HTTP 层要求 body 含 `confirm: true` 或请求头 `x-daily-confirm: true`，否则 428。
- CLI 需 `--yes`，否则退出码 5。
- MCP 工具 schema 自动加入 `confirm` 字段；AI 不允许自行确认破坏性操作，一律返回「待确认」。
- AI 的非破坏性变更还受 `confirmTools`（界面「允许执行变更」开关）控制。

## 5. 操作分组（节选）

| 组 | 操作 |
|---|---|
| task | create / update / move / complete / reopen / delete / get / list / activity |
| history | undo（最近一次任务创建/更新/完成/删除） |
| tag | list / create / update / delete |
| space | list / create / update |
| settings | get / update |
| project | list / get / create / update / archive / delete |
| deliverable | list / create / update / delete |
| template | list / create / delete / apply |
| today / day | today.get / day.get |
| capacity | set |
| calendar / timeline | range |
| review | week |
| routine | list / create / toggle / delete |
| focus | start / finish / cancel / list / stats / active |
| memo | list / create / get / update / delete / stats / toTask |
| inbox | capture / list |
| document | list / get / create / update / saveBody / delete / archive / getMeta |
| search | search.all |
| attachment | list / delete / stats |
| analytics | dashboard |
| meta / health | meta.get / health.get |
| backup | export / import |
| lan | info |
| ai | chat / status / provider.* / conversations.* |

`daily ops` 列出全部 CLI 暴露项；`GET /api/ops` 返回机器可读 JSON Schema。

## 6. 契约测试

- 每个 op 的 zod 输入校验、错误码、幂等重放。
- HTTP 信封与 CLI 输出一致（同一 `opId` 重试）。
- 破坏性操作的 428 / `--yes` 行为。
- AI 工具：只读自动执行、变更受开关、破坏性恒拒绝。
- MCP `tools/list` 的 schema 可解析、工具名稳定。

实现见 `apps/server/src/app.test.ts` 与后续 `e2e/ops.spec.ts`。

## 7. 扩展规则

- 操作语义不可原地修改：改语义 → 新版本号 + 迁移器 + 新名称（MCP 客户端会缓存 schema）。
- 查询必须有默认上限；列表类默认 200，最大 500。
- 新增 op 必须同时补：单元/集成测试、CLI 示例、文档表格、AI/MCP 暴露评估。
