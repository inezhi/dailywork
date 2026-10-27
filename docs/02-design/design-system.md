# 设计系统

版本：v2.0 · 更新：2026-10-27 · 飞书归档：[04 设计系统](https://my.feishu.cn/docx/RXNhd8p0IobTVQxTjgscCYbMnlb) · 品牌页：[05 设计稿](https://my.feishu.cn/docx/M7PDdxywCoxjKQxjrwvctmUunPd)

## 1. 设计立场

时序不是「又一个效率工具」。它要让人**安静地开始一件重要的事**。因此：

1. 信息结构优先：靠排版层级、留白、1px 分隔线组织内容，不用「什么都是圆角卡片」。
2. 单一强调色：经典蓝（默认 #1677FF）只用于主操作、进度、选中态与专注环。语义色只表达成功/警告/危险/信息。
3. 半径分级：输入 6px、卡片 10px、抽屉/弹窗 14px；不统一圆角，也不叠加阴影。
4. 动效只响应用户动作（展开、拖拽、完成），120–200ms；尊重 `prefers-reduced-motion`。
5. 图标统一 Lucide（stroke 1.7–2），不用 emoji 当图标；不用全大写 eyebrow、装饰渐变、玻璃拟态。
6. 中英文混排：Inter Variable + PingFang SC；数字 tabular numerals；文档阅读态 Source Serif 4。

**签名元素**：专注环。出现在今天页头、专注模式、顶栏计时、仪表盘；默认蓝色强调，其他界面保持克制。

## 2. 色彩 tokens

浅色（默认冷白 / 经典蓝）：

| Token | 值 | 用途 |
|---|---|---|
| `--bg` / `--bg-elevated` | `#F5F7FA` / `#FFFFFF` | 画布 / 浮层 |
| `--sunken` | `#F0F2F5` | 侧栏、分组背景、输入底 |
| `--card` / `--card-soft` | `#FFFFFF` / `#FAFBFC` | 卡片 / 卡片 hover |
| `--line` / `--line-soft` / `--line-strong` | `#E5E6EB` / `#F0F1F3` / `#C9CDD4` | 边框 / 内部分隔 / 强调边界 |
| `--ink` / `--ink-2` | `#1D2129` / `#4E5969` | 正文 / 次级正文 |
| `--ink-3` / `--ink-4` | `#6B7785` / `#A9B0BA` | 辅助信息 / 占位 |
| `--accent` / `--accent-strong` | `#1677FF` / `#0958D9` | 主操作、进度、选中 |
| `--accent-soft` | `accent 12% + bg` | 选中底、标签 |
| `--success` / `--warning` / `--danger` / `--info` | `#52C41A` / `#FAAD14` / `#FF4D4F` / `#13C2C2` | 语义 |

深色：`--bg #17171A`、`--sunken #101012`、`--card #1F1F22`、`--line #333338`、`--ink #F7F8FA`、`--accent #4096FF`、`--accent-strong #69B1FF`。深色不是反色，而是重新定值的蓝灰体系。

中性色温：默认「冷」使用上面的冷白；「暖」回到 `#FAF9F5 / #F1EFE7 / #141413` 的暖米白组；「中性」使用 `#FAFAFA / #F2F2F2 / #1F1F1F`。强调色和语义色不随中性温度改变。

**主题编辑器**：强调色任意取色 + 6 个预设（默认「经典蓝」）；四个语义色独立可调；中性色温「暖 / 中性 / 冷」切换 `--bg/--sunken/--line` 组；密度「舒适 / 紧凑」调整行高。运行时把设置写入 `document.documentElement` 的 CSS 变量与 `data-theme/neutral/density`。强调色按亮度自动选择白/墨色前景（`contrastText`），`--accent-strong` 由强调色自动混合生成。

**对比度**：正文使用 `--ink`；`--ink-3` 仅用于 ≥10.5px 辅助信息；强调色小字使用 `--accent-strong`；蓝色在冷白画布上具有足够对比度。

## 3. 字体与字阶

- UI：`Inter Variable, -apple-system, PingFang SC, Noto Sans SC, sans-serif`。
- 文档/品牌：`Source Serif 4 Variable, Songti SC, serif`。
- 字阶：9 / 10 / 10.5 / 11 / 11.5 / 12 / 12.5 / 13 / 14 / 15 / 16 / 18 / 19 / 20 / 21 / 22 / 23 / 24 / 26 / 27 / 28 / 30 / 32 / 40。
- 行高：正文 1.5–1.7；标题 1.2–1.4；中文正文行宽 ≤ 78 字符。
- 标题字重 650–720；正文 450–550；数字 600–680，`font-variant-numeric: tabular-nums`。
- 字距：大标题 -0.4 ~ -0.8px；品牌字标 0.3px；英文小标签 1.2px。

## 4. 间距、半径、阴影

- 间距基数 4：4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 24 / 28 / 32 / 40 / 56。
- 页面：桌面 26–32px 内边距，最大内容宽 1180px；看板/日历/文档为全宽模式。
- 半径：`5 / 7 / 10 / 14 / 18`，按层级使用（输入 6–7、卡片 10、抽屉/弹窗 14）。
- 阴影：`0 1px 2px rgba(28,27,25,.04)`；浮层 `0 14px 38px rgba(.09)`。主要靠 1px 边框分层。

## 5. 组件

AppShell / SidebarNav / TopBar / CommandPalette / TaskRow / TaskDrawer / StatusButton / PriorityFlag / ProjectChip / TagChip / QuickAdd / FocusRing / Kanban / Calendar / Timeline / MemoCard / BlockEditor / KPI / TrendChart / Donut / Insight / Settings / EmptyState / Toast / ConfirmDialog / Modal / AI Panel。

状态覆盖：hover、focus-visible（2px accent 外描边）、disabled（opacity .5）、selected（accent-soft + 边框）、拖拽（45% 透明 + 旋转 1.2° 预览）、空状态（图标 + 一句邀请 + 主操作）。

## 6. 布局与响应式

| 断点 | 布局 |
|---|---|
| ≥1440 | 侧栏 248px + 画布 + 抽屉 420px |
| 1024–1439 | 抽屉浮层；侧栏可折叠为 72px 图标条 |
| 768–1023 | 图标侧栏；看板横向滚动；日历议程在右 |
| <768 | 单列；底部 Tab（今天 / 日历 / 看板 / 文档 / 仪表盘）；全屏抽屉；44px 触控目标；隐藏侧栏与面包屑 |

桌面（Electron）为 `hiddenInset` 标题栏：侧栏顶部预留 46px 给红绿灯，顶栏可拖动（按钮 `no-drag`）。

## 7. 品牌

- 标识：透明 PNG，1024×1024；牛奶盒 + 咖啡豆/叶，鼠尾草绿 / 沙金 / 米白 / 墨色 / 深松绿。
- 最小尺寸 24px；16px 只保留盒身轮廓或改用字标。
- 不拉伸、不改描边、不加圆角底板；深色背景需加米白底板（浅色描边版本待补）。
- 品牌资产：`design/brand/logo-carton.png`、`logo-carton-sheet.png`、`draw_carton.py`；应用图标 `apps/desktop/build/icon.icns`；PWA 图标为米白底 192/512。

## 8. 无障碍

- 所有交互元素可键盘到达；`Esc` 关闭抽屉/面板；`⌘K` 搜索、`⌘N` 新建、`⌘J` AI。
- 焦点可见；状态不只靠颜色（状态点 + 文案）。
- 触控目标 ≥ 44px（移动端）；对比度按 WCAG AA 目标。
- `prefers-reduced-motion` 下动画降至 0.01ms。
- 图片 `alt`、按钮 `aria-label`、弹窗 `role=dialog aria-modal`。

## 9. 设计资产

- 9 张高保真参考稿：`design/mockups/01_today.png` … `09_mobile_dashboard.png`（HTML 源同目录）。
- 13 张架构/流程/ER 图：`design/diagrams/*.svg`（Mermaid/生成脚本同目录）。
- 设计画廊：应用内 `/design`，实时反映当前主题的 tokens、按钮、状态、空状态与图表。
- 视觉验收截图：`design/qa/*.png`（桌面 1440×960、Electron 2x、移动端）。
