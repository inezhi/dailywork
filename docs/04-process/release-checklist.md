# 发布清单（v0.2.0）

## 版本记录

- [ ] 更新所有 package.json 版本与版本常量
- [ ] `apps/web/src/content/releases.ts` 顶部新增版本记录
- [ ] `docs/04-process/CHANGELOG.md` 顶部新增同内容记录
- [ ] 安装包文件名包含新版本号

## 构建

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`
- [ ] `pnpm build:desktop` 生成 `apps/desktop/release/Dailywork-0.2.0-arm64.dmg`
- [ ] dmg 在干净用户目录挂载安装；首次打开通过 Gatekeeper（右键打开或系统设置放行）
- [ ] 应用图标、托盘图标、窗口标题正确；红绿灯不遮挡品牌区

## 功能冒烟

- [ ] 全新数据目录启动 → 默认空间存在 → 创建任务 → 重启仍在
- [ ] 今天页容量、专注环、分组、逾期提示正确
- [ ] 看板拖拽、键盘拖拽、完成列展开
- [ ] 日历月/周/日切换与当日议程
- [ ] 文档创建、输入、图片插入、自动保存、重启仍在
- [ ] 速记 → 转任务；收件箱整理
- [ ] 专注开始 → 刷新恢复 → 结束累计实际分钟
- [ ] 仪表盘 KPI / 趋势随完成任务变化
- [ ] ⌘K 搜索、⌘N 新建、⌘J AI、Esc 关闭
- [ ] 设置：主题强调色/中性/密度、AI 供应商测试、数据目录、CLI 示例
- [ ] 导出 `.dailywork` → 空目录导入 → 重启后数据完整
- [ ] 局域网：开启后手机配对、创建任务、添加到主屏幕
- [ ] CLI：`daily task create` / `list` / `complete` / `mcp serve` tools/list
- [ ] AI：配置 DeepSeek 测试连通；只读工具自动执行；变更需开关；破坏性需人工

## 质量

- [ ] 深色/浅色截图；390×844 移动端无横向滚动；Keyboard-only 走查
- [ ] 1 万任务性能抽样（列表、仪表盘）
- [ ] 日志不含任务正文/密钥；runtime.json 0600
- [ ] CHANGELOG 更新；tag `v0.2.0`；文档归档到飞书

## 已知限制（随发布说明）

- ad-hoc 签名，首次打开需手动放行；无自动更新。
- 局域网 HTTP 下 Service Worker 不注册；离线缓存需 HTTPS。
- 不支持多设备同步/多人协作。
