# 测试与质量

更新：2026-10-27 · 飞书归档：[12 测试方案](https://my.feishu.cn/docx/R43sdlwRmo2ZBmxGopacAjfrnrd)

## 1. 分层

| 层 | 工具 | 范围 |
|---|---|---|
| 单元 | Vitest | 时间/日期、状态机、搜索、备份校验、AI 工具循环（mock 供应商） |
| 集成 | Vitest + Hono `app.request()` | ops 信封、幂等、确认、审计、迁移、读模型 |
| 端到端 | Playwright（Chrome + Electron） | 核心旅程：创建 → 改期 → 拖拽 → 完成 → 刷新仍在；文档编辑；速记转任务；主题；移动端布局 |
| 打包验收 | 手动 + Playwright Electron | dmg 安装、首次启动、无网络、重启数据仍在 |

## 2. 命令

```bash
pnpm test                 # Vitest 全部
pnpm vitest run apps/server/src/app.test.ts -t "idempotent"
pnpm test:e2e             # Playwright（需先启动服务与 Web）
pnpm typecheck
pnpm lint
pnpm build
```

## 3. 当前覆盖（v0.1.0）

`apps/server/src/app.test.ts` + `features.test.ts`（12 个集成测试）：

- 创建 / 列表任务。
- 同一 `opId` 重复创建只产生一条。
- 空标题返回 `VALIDATION_ERROR`。
- 删除需要 `confirm`。
- 完成任务写入 `op_log`（`task.complete`）。
- 今天读模型与仪表盘趋势长度。
- 附件 sha256 去重与零引用回收。
- `expectedVersion` 冲突。
- 单实例专注与任务实际分钟回填。
- `.dailywork` 导出 → 新目录导入 → 数据一致。
- AI 工具：未开启变更时拒绝，开启后执行并写入 actor=ai 审计。

Playwright（6 个核心旅程）：创建/编辑/完成/刷新仍在、速记转任务、文档保存与重载、⌘K 搜索、深浅主题、移动端无横向滚动。

待补：LAN 配对自动化、迁移 v1→v2、离线与并发压力。

## 4. 数据与隔离

- 测试使用 `mkdtemp` 临时目录，`createApp({dataDir})` 直接调用 fetch handler，无端口。
- 每个测试文件独立数据库；`afterAll` 清理目录。
- 不使用用户真实数据目录；`.data` 仅供本地开发。

## 5. 发布门禁

1. `pnpm lint` 0 error（warning 允许）。
2. `pnpm typecheck` 通过。
3. `pnpm test` 全绿。
4. `pnpm build` 成功。
5. `pnpm test:e2e` 核心旅程通过（CI 可选 macOS runner）。
6. 打包 dmg 后手动冒烟：全新数据目录 → 创建任务 → 关闭重开 → 数据仍在；导出 → 导入。
7. 深色 / 浅色截图归档；移动端 390×844 无横向滚动。

## 6. 性能基线

- 1 万任务：列表查询（LIMIT 200）< 100ms；仪表盘 30 天聚合 < 200ms。
- 文档输入到保存防抖 850ms；任务标题 550ms。
- 打包体积：JS gzip ≈ 315KB；Electron dmg 约 120–160MB（可接受）。

## 7. 可观测

- pino 结构化日志写入 `logs/dailywork.log`（不含任务正文与密钥）。
- `op_log` 审计所有写操作（含 actor: user/cli/ai）。
- 崩溃恢复：SQLite WAL；启动时自动取消 6 小时前的 running 专注会话；导入暂存文件在启动时应用。
