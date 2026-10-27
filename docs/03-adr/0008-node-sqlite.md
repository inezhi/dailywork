# ADR-0008：使用 Node 内置 node:sqlite，而非 better-sqlite3 + Drizzle

状态：已接受 · 2026-10-27

## 背景

better-sqlite3 是原生模块，需要针对 Electron ABI 重建（electron-rebuild），打包与升级链路复杂；当前 Electron 45 内置 Node 24.22，`node:sqlite` 可用。

## 决策

- 使用 `node:sqlite` 的 `DatabaseSync`（WAL、busy_timeout、foreign_keys）。
- 不引入 ORM；SQL 集中在上下文仓储/服务内，使用 hand-written 查询与显式映射。
- 迁移为顺序 SQL 常量，`schema_migrations` 记录版本；启动时在事务内执行。
- 行类型通过 `as unknown as Row` 显式断言（node:sqlite 的返回类型为通用记录）。

## 结果

- 零原生编译、打包稳定；性能满足单用户。
- 失去 Drizzle 的类型推导/迁移 DSL；通过 zod DTO 与集成测试兜底。
