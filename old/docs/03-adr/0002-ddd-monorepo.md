# ADR-0002：DDD 纵向切片与 monorepo

状态：已接受 · 2026-10-27

## 背景

功能面大（任务、项目、计划、专注、文档、AI），需要在单人开发下仍保持边界清晰、可独立演进。

## 决策

- pnpm workspace；`apps/`（server/web/desktop/cli）与 `packages/`（contracts/platform/ops/contexts/analytics/attachments）。
- 每个限界上下文一个包，公开入口为 `packages/contexts/<ctx>/src/index.ts`；内部不强制分层目录，但写路径经应用函数，SQL 集中在上下文内。
- `packages/ops` 依赖上下文并组合操作目录；`apps/server` 只做 HTTP 装配；`apps/web` 只经 ops 访问数据。
- 跨上下文只读投影（analytics、attachments）单独成包，明确例外。
- 共享 DTO 与 zod schema 放 `packages/contracts`，Web/CLI/服务共用。

## 结果

- 上下文边界可通过 import 图审查；不会出现 UI 直接写库。
- 包以 TS 源码导出（`exports: ./src/index.ts`），开发/测试零构建；生产由 esbuild/Vite 打包。
- 路径别名需在 tsconfig、Vitest、Vite 三处同步（见 CLAUDE.md）。
