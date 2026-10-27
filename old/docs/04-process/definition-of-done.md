# Definition of Done

一个功能只有在以下全部满足时才算完成：

- [ ] 行为符合 PRD 验收标准；边界与错误路径有明确反馈（文案、错误码）。
- [ ] 通过 ops 契约实现；HTTP / CLI / MCP / AI 暴露按需更新。
- [ ] 写操作有 `op_log`；破坏性操作有确认；幂等与 `expectedVersion`（如适用）。
- [ ] 单元或集成测试覆盖核心不变量；关键旅程有 e2e 或手动验收记录。
- [ ] `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 全绿。
- [ ] UI：浅/深色、桌面/移动端、hover/focus/disabled/空状态检查；无横向滚动。
- [ ] 文档：PRD / 架构 / ADR / CHANGELOG 中至少一处反映变更；CLAUDE.md 在命令或结构变化时更新。
- [ ] 无敏感信息入库；数据目录、日志、备份的行为符合预期。
- [ ] 截图或录屏归档到 `design/qa/`（如涉及视觉变更）。
