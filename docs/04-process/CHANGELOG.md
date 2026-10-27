# Changelog

All notable changes to this project are documented here.

## [0.1.0] — 2026-10-27

### Added

- **本地优先架构**：Electron 45 + Hono（utilityProcess）+ SQLite（`node:sqlite`，WAL）；单实例 runtime 文件；打包版同源托管 Web。
- **任务与视图**：任务 / 子任务 / 状态机 / 优先级 / 标签 / 计划与截止 / 预估；今天、全部任务（列表 / 四象限）、看板（拖拽）、日历（月/周/日）、时间轴（28 天）。
- **项目与空间**：空间创建、项目工作台、验收标准、交付成果、任务模板保存/应用、最近操作记录。
- **速记与收件箱**：flomo 式卡片、`#标签`、置顶、搜索、转任务、图片/PDF 附件；收件箱聚合。
- **计划与专注**：每日收尾（日注、未完成移到明天）；每日容量；每日例程；专注计时（15/25/45/60/自定义）、会话恢复、统计、任务实际分钟回填、专注环。
- **文档中心**：TipTap 块编辑器（标题/列表/待办/引用/代码/表格/图片/链接/高亮）、文档树、反向链接、自动保存。
- **仪表盘**：KPI、趋势、项目推进、状态分布、空间负载、洞察、需要关注、本周复盘弹窗。
- **AI 助理**：DeepSeek/OpenAI 兼容供应商、AES-256-GCM 密钥、流式工具调用（SSE）、对话历史、变更开关、破坏性操作护栏、对话持久化；任务拆解、文档润色/续写/摘要/提取任务、周复盘上下文入口。
- **CLI / MCP**：`daily` 覆盖全部 ops、`--json` 信封、稳定退出码、自动拉起服务；`daily mcp serve` 暴露 70+ 工具。
- **附件**：任务/文档图片与 PDF、sha256 去重、浏览器 320px WebP 缩略图、引用计数回收。
- **备份**：`.dailywork` 导出（manifest + SQLite + 密钥 + README）、导入校验、暂存与重启原子替换、导入前自动备份、每日自动快照保留 14 份。
- **局域网**：LAN 开关、6 位配对码、HttpOnly cookie、持久化服务 token（配对跨重启）、可选自签名 HTTPS（固定 47822）、PWA manifest / 图标 / Service Worker 离线壳。
- **设计系统**：暖米白 + 陶土橙 tokens、深浅主题、自定义强调色/语义色/中性色温/密度、`/design` 活文档；牛奶盒品牌标识；首启三步引导。
- **工程**：pnpm 10 + Turborepo、TypeScript strict、ESLint 9、Vitest 46 个单元/集成测试、Playwright 9 个（Chrome + WebKit iPhone）、Electron/DMG 冒烟。

### Changed

- 取消 iCloud 同步，改为本地数据库 + 导出/导入（ADR-0003）。
- `better-sqlite3 + Drizzle` → `node:sqlite` + 手写 SQL（ADR-0008）。
- `TipTap + Yjs` → TipTap JSON（ADR-0007）。
- FullCalendar / ECharts → 自绘日历/时间轴/SVG 图表。

### Known issues

- 空间级禁止 AI、全局撤销、Developer ID 公证与真机 iPhone 验收尚未完成。
- 局域网 HTTP 下 PWA 离线缓存不可用；Electron 为 ad-hoc 签名。
