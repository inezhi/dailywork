# ADR-0005：统一 Ops 目录与四个表面

状态：已接受 · 2026-10-27

## 背景

AI 与 CLI 需要覆盖全部界面操作，且不能出现「UI 一套逻辑、CLI 另一套逻辑」的漂移。

## 决策

- 所有能力定义为 op（name/version/input zod/exposure/annotations/handler），handlers 服务于同一个应用层。
- HTTP `POST /api/ops/<name>` 为唯一写入口；CLI 命令树由 `exposure.cli` 自动生成；MCP 工具由 `exposure.mcp` 生成；AI 工具由 `exposure.ai` 生成。
- 统一信封、错误码、HTTP 状态与 CLI 退出码；每个 command 支持 `opId` 幂等与 `expectedVersion` 乐观并发；破坏性操作需确认。
- AI 变更受 UI 开关约束；破坏性操作永不自动确认。

## 结果

- UI/CLI/MCP/AI 行为一致，测试可复用同一信封断言。
- 新能力必须同时考虑四个表面与文档，增加少量仪式感，换取可维护性。
