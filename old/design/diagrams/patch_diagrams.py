#!/usr/bin/env python3
"""Patch gen_diagrams.py: fix overlaps, margins and arrow directions."""
import re

P = "gen_diagrams.py"
src = open(P, encoding="utf-8").read()

D1 = r'''def d1():
    s = SVG(1240, 720, "系统上下文", "C4 Level 1 · macOS 单机权威 + iCloud 备份 + 局域网移动端", "ARCHITECTURE")
    s.title_block("ARCHITECTURE")

    # mac boundary
    s.rect(56, 120, 590, 540, fill="#F3F0E8", stroke=BORDER_STRONG, rx=20, sw=1.2, dash="7 6")
    s.text(80, 150, "macOS · 设备（唯一写入口）", size=14, fill=INK2, weight=600)
    s.icon("window", 560, 134, color=INK3, scale=0.8)

    # Electron
    s.rect(84, 176, 230, 84, shadow=True)
    s.icon("window", 100, 194, color=ACCENT)
    s.text(138, 203, "Electron 桌面壳", size=15, weight=600)
    s.text(138, 225, "窗口 · 托盘 · 全局快捷键 · 通知", size=11.5, fill=INK2)
    s.text(138, 244, "utilityProcess 启动服务", size=11.5, fill=INK3)

    # Web UI
    s.rect(84, 286, 230, 84, shadow=True)
    s.icon("window", 100, 304, color=INFO)
    s.text(138, 313, "React Web UI", size=15, weight=600)
    s.text(138, 335, "今天 · 看板 · 日历 · 仪表盘", size=11.5, fill=INK2)
    s.text(138, 354, "同时提供 localhost 浏览器访问", size=11.5, fill=INK3)

    # CLI / MCP
    s.rect(84, 398, 108, 64)
    s.text(102, 424, "daily CLI", size=13, weight=600)
    s.text(102, 444, "脚本与 AI", size=11, fill=INK3)
    s.rect(206, 398, 108, 64)
    s.text(224, 424, "MCP Server", size=13, weight=600)
    s.text(224, 444, "Claude Code 等", size=11, fill=INK3)

    # Hono server
    s.rect(356, 250, 250, 160, fill=CARD, stroke=ACCENT, rx=14, sw=1.6, shadow=True)
    s.icon("server", 376, 268, color=ACCENT)
    s.text(414, 280, "Hono 服务", size=17, weight=700)
    s.text(376, 310, "领域应用层唯一写入口", size=12, fill=INK2)
    s.pill(376, 324, "ops 分发", ACCENT_DEEP, ACCENT_SOFT, size=11)
    s.pill(452, 324, "HTTP + WS", ACCENT_DEEP, ACCENT_SOFT, size=11)
    s.pill(376, 356, "鉴权 · 限流 · SSE", ACCENT_DEEP, ACCENT_SOFT, size=11)
    s.text(376, 396, "127.0.0.1（默认） / LAN（可选 HTTPS）", size=11, fill=INK3)

    # SQLite / Keychain
    s.rect(330, 458, 170, 78, shadow=True)
    s.icon("db", 346, 474, color=SUCCESS)
    s.text(384, 486, "SQLite（WAL）", size=13, weight=600)
    s.text(346, 514, "权威数据 · op_log · outbox", size=11, fill=INK2)
    s.rect(516, 458, 120, 78)
    s.icon("key", 530, 474, color=WARN)
    s.text(562, 486, "Keychain", size=13, weight=600)
    s.text(530, 514, "AI API Key", size=11, fill=INK2)

    # iCloud
    s.rect(742, 262, 186, 136, shadow=True)
    s.icon("cloud", 758, 278, color=INFO, scale=1.1)
    s.text(800, 292, "iCloud Drive", size=16, weight=700)
    s.text(758, 320, "Dailywork/", size=12, fill=INK2)
    s.pill(758, 332, "ops 分段", INFO, INFO_SOFT, size=11)
    s.pill(826, 332, "快照", INFO, INFO_SOFT, size=11)
    s.pill(758, 364, "附件 blob", INFO, INFO_SOFT, size=11)
    s.text(758, 404, "只做备份与恢复，不放活数据库", size=11, fill=INK3)

    # Phone
    s.rect(1010, 236, 178, 130, shadow=True)
    s.icon("phone", 1026, 252, color=ACCENT)
    s.text(1062, 268, "iPhone / iPad", size=14, weight=600)
    s.text(1026, 296, "Safari PWA", size=12, fill=INK2)
    s.text(1026, 318, "同一 Wi-Fi · HTTPS 局域网", size=11.5, fill=INK3)
    s.pill(1026, 332, "配对码登录", INK2, "#F6F3EC", size=11)
    s.text(1026, 366, "点击卡片 → Hono 服务", size=11, fill=INK3)

    # LLM
    s.rect(1010, 446, 178, 130, shadow=True)
    s.icon("spark", 1026, 462, color=ACCENT)
    s.text(1062, 478, "模型供应商", size=14, weight=600)
    s.text(1026, 506, "DeepSeek（默认）", size=12, fill=INK2)
    s.text(1026, 528, "任意 OpenAI 兼容端点", size=11.5, fill=INK3)
    s.text(1026, 550, "仅 AI 请求携带上下文", size=11, fill=INK3)
    s.text(1026, 572, "OpenAI 兼容 API", size=11, fill=INK3)

    # arrows — every head lands on a target edge
    s.arrow([(199, 260), (199, 286)], label="渲染", lp=(199, 276))
    s.arrow([(314, 328), (356, 328)], label="HTTP / WS", lp=(335, 320))
    s.arrow([(199, 398), (199, 380), (380, 380), (380, 410)], label=None)
    s.arrow([(481, 410), (481, 458)], label="读写", lp=(481, 438))
    s.arrow([(576, 410), (576, 458)], label="解密", lp=(576, 438))
    s.arrow([(606, 320), (742, 320)], color=INFO, label="备份", lp=(674, 310))
    s.arrow([(742, 345), (606, 345)], color=INFO, label="恢复", lp=(674, 335))
    # phone -> Hono, below iCloud
    s.arrow([(1100, 366), (1100, 425), (560, 425), (560, 410)], color=INFO, label=None)
    # LLM -> Hono, below iCloud and above Keychain
    s.arrow([(1010, 500), (1010, 445), (600, 445), (600, 410)], color=ACCENT, label=None)

    # note
    s.rect(84, 575, 562, 62, fill=CARD, stroke=BORDER, rx=12)
    s.text(102, 599, "关键约束", size=12, weight=600, fill=ACCENT_DEEP)
    s.text(102, 620, "默认只监听 127.0.0.1；LAN 需 HTTPS + 配对码；AI Key 只存 Keychain；iCloud 不存活数据库。", size=11.5, fill=INK2)

    s.footer()
    save(s, "d1_system_context.svg")

'''

D2 = r'''def d2():
    s = SVG(1240, 980, "容器与代码结构", "Electron 壳 · React Web · Hono 服务 · CLI/MCP · DDD 纵向切片", "ARCHITECTURE")
    s.title_block("CONTAINERS")

    def col(x, title, tint):
        s.text(x, 134, title, size=12, weight=700, fill=tint)
        s.line(x, 144, x + 250, 144, color=BORDER, sw=1)

    col(72, "APPS · 入口", ACCENT_DEEP)
    col(476, "PACKAGES · 领域与契约", SUCCESS)
    col(880, "DATA & PLATFORM", INFO)

    apps = [
        ("desktop/", "Electron 主进程 · preload", "窗口 / 托盘 / 通知 / 快捷键"),
        ("server/", "Hono 组合根", "ops 路由 · WS · 静态资源"),
        ("web/", "React 应用", "视图 · 查询缓存 · 乐观更新"),
        ("cli/", "daily + MCP", "attach 服务 · JSON 输出"),
    ]
    y = 164
    for name, desc, sub in apps:
        s.rect(72, y, 250, 86, shadow=True)
        s.text(90, y + 24, name, size=14, weight=700, fill=INK)
        s.text(90, y + 46, desc, size=12, fill=INK2)
        s.text(90, y + 66, sub, size=11, fill=INK3)
        y += 102

    pkgs = [
        ("contracts/", "DTO · zod · op envelope", SUCCESS, 72),
        ("ops/", "操作目录 · 四入口生成器", ACCENT_DEEP, 72),
        ("contexts/", "workspace · tasking · projects · capture\nplanning · focus · documents · assistant", INK2, 126),
        ("platform/", "SQLite · migrations · Keychain\nSyncTransport · logging", INFO, 110),
        ("analytics/", "仪表盘只读投影", INFO, 72),
        ("design-system/", "tokens · 组件 · Storybook", INK2, 72),
    ]
    y = 164
    for name, desc, tint, h in pkgs:
        s.rect(476, y, 330, h, shadow=True)
        s.text(494, y + 24, name, size=14, weight=700, fill=tint if tint != INK2 else INK)
        for j, line in enumerate(desc.split("\n")):
            s.text(494, y + 48 + j * 18, line, size=11.5, fill=INK2)
        y += h + 12

    data = [
        ("SQLite（WAL）", "data.sqlite · 权威库", SUCCESS_SOFT, SUCCESS),
        ("op_log / outbox", "同事务写入 · 可重放", ACCENT_SOFT, ACCENT_DEEP),
        ("iCloud Drive", "密封分段 · 快照 · blob", INFO_SOFT, INFO),
        ("Keychain", "AI Key · safeStorage", WARN_SOFT, WARN),
        ("daily token", "0600 文件 · 设备鉴权", "#F6F3EC", INK2),
    ]
    y = 164
    for name, desc, bg, fg in data:
        s.rect(880, y, 300, 74, fill=bg, stroke="none", rx=12)
        s.text(898, y + 28, name, size=13.5, weight=700, fill=INK)
        s.text(898, y + 50, desc, size=11.5, fill=fg)
        y += 88

    s.arrow([(322, 206), (476, 206)], color=ACCENT, label="构建依赖", lp=(399, 196))

    s.rect(72, 790, 1108, 62, fill=CARD, stroke=BORDER, rx=12)
    s.text(92, 814, "依赖规则", size=12, weight=700, fill=ACCENT_DEEP)
    s.text(160, 814, "interface → application → domain；contexts 只依赖公开 application 接口与 contracts；由 dependency-cruiser 在 CI 强制执行。", size=11.5, fill=INK2)
    s.text(92, 835, "禁止跨上下文写；最终一致副作用走 outbox 事件；analytics 与 sync 只读订阅，不反向依赖业务上下文。", size=11.5, fill=INK3)

    s.footer()
    save(s, "d2_containers.svg")

'''

D3 = r'''def d3():
    s = SVG(1240, 760, "DDD 限界上下文映射", "8 个核心域 + 4 个支撑子系统 · 依赖方向由 CI 强制", "DOMAIN")
    s.title_block("DOMAIN")

    # legend (top-right, clear of cards)
    s.pill(960, 108, "核心域", ACCENT_DEEP, ACCENT_SOFT, size=11)
    s.pill(1042, 108, "支撑", INK3, "#F6F3EC", size=11)
    s.text(960, 152, "跨上下文写：禁止", size=11, fill=DANGER)
    s.text(960, 172, "查询：同步 application 调用", size=11, fill=INK2)

    def ctx(x, y, w, h, name, sub, tint=INK, bg=CARD, border=BORDER, badge=None):
        s.rect(x, y, w, h, fill=bg, stroke=border, rx=12, shadow=True)
        s.text(x + 18, y + 28, name, size=15, weight=700, fill=tint)
        s.text(x + 18, y + 49, sub, size=11, fill=INK3)
        if badge:
            s.pill(x + w - 18 - (tw(badge, 10) + 20), y + 14, badge, ACCENT_DEEP, ACCENT_SOFT, size=10, h=20, pad=9)

    ctx(72, 200, 200, 92, "workspace", "空间 · 偏好 · 主题", INK)
    ctx(72, 340, 200, 92, "projects", "项目 · 验收 · 交付物", INK)
    ctx(72, 480, 200, 92, "capture", "收件箱 · 速记", INK)
    ctx(560, 210, 200, 120, "tasking", "任务 · 状态机 · 日期与预估", ACCENT_DEEP, CARD, ACCENT, badge="CORE")
    ctx(560, 390, 200, 92, "planning", "时间块 · 容量 · 例程", INK)
    ctx(880, 200, 200, 92, "documents", "文档树 · 块正文 · 双链", INK)
    ctx(880, 340, 200, 92, "focus", "番茄钟 · 专注会话", INK)
    ctx(880, 480, 200, 92, "assistant", "供应商 · 对话 · 工具调用", INK)

    # support band
    s.text(72, 600, "支撑子系统（只读 / 平台能力，不作为核心域） · analytics 订阅 outbox；sync 只复制 op_log", size=12, weight=700, fill=INK3)
    supp = [("analytics", "仪表盘投影", INFO, INFO_SOFT), ("sync", "op_log 复制与恢复", INFO, INFO_SOFT),
            ("ops", "操作目录与四入口", ACCENT_DEEP, ACCENT_SOFT), ("design-system", "tokens 与组件", INK2, "#F6F3EC")]
    x = 72
    for name, desc, fg, bg in supp:
        w = 250
        s.rect(x, 620, w, 74, fill=bg, stroke="none", rx=12)
        s.text(x + 18, 646, name, size=13.5, weight=700, fill=INK)
        s.text(x + 18, 668, desc, size=11, fill=fg)
        x += w + 22

    # dependencies (arrows land on target edges)
    s.arrow([(272, 246), (330, 246), (330, 258), (560, 258)], color=INK3, label="spaceId", lp=(410, 248), label_size=10)
    s.arrow([(272, 386), (450, 386), (450, 300), (560, 300)], color=INK3, label="projectId", lp=(450, 372), label_size=10)
    s.arrow([(272, 526), (470, 526), (470, 312), (560, 312)], color=ACCENT, label="转任务", lp=(470, 512), label_size=10)
    s.arrow([(660, 390), (660, 330)], color=INK3, label="读取任务", lp=(722, 364), label_size=10)
    s.arrow([(880, 246), (760, 246), (760, 268)], color=INK3, label="挂载", lp=(820, 236), label_size=10)
    s.arrow([(880, 386), (760, 386), (760, 316)], color=INK3, label="回写实际时长", lp=(820, 376), label_size=10)
    s.arrow([(880, 526), (760, 526), (760, 436)], color=INK3, label="经 ops 调用", lp=(820, 516), label_size=10)

    s.footer()
    save(s, "d3_context_map.svg")

'''

D6 = r'''def d6():
    s = SVG(1240, 800, "AI 工具调用与护栏", "只读自动执行 · 变更人工确认 · 空间级禁用 · 全程审计", "AI")
    s.title_block("AI")

    def node(x, y, w, h, title, desc, tint=INK, fill=CARD, border=BORDER):
        s.rect(x, y, w, h, fill=fill, stroke=border, rx=12, shadow=True)
        s.text(x + 18, y + 28, title, size=14, weight=700, fill=tint)
        s.text(x + 18, y + 50, desc, size=11, fill=INK3)

    def diamond(cx, cy, w, h, text, tint=WARN):
        pts = [(cx, cy - h / 2), (cx + w / 2, cy), (cx, cy + h / 2), (cx - w / 2, cy)]
        p = " ".join(f"{x},{y}" for x, y in pts)
        s.add(f'<polygon points="{p}" fill="{CARD}" stroke="{tint}" stroke-width="1.5"/>')
        s.text(cx, cy + 4, text, size=12, weight=600, fill=tint, anchor="middle")

    # row 1
    node(72, 150, 230, 78, "用户意图", "自然语言 · 当前视图 · 选中任务")
    node(380, 150, 230, 78, "模型生成工具调用", "只能调用 ai=true 的 op")
    diamond(760, 189, 150, 84, "只读？")
    node(960, 150, 210, 78, "直接执行", "查询 / 搜索 / 读取上下文", SUCCESS, SUCCESS_SOFT, SUCCESS)
    node(960, 300, 210, 78, "审计日志", "opId · provider · 结果", INFO, INFO_SOFT, INFO)

    # row 2
    diamond(500, 380, 170, 88, "空间禁用 AI？", DANGER)
    node(760, 420, 210, 78, "返回拒绝", "不读取、不发送任何内容", DANGER, DANGER_SOFT, DANGER)
    node(140, 340, 250, 78, "确认卡片", "人类可读摘要 + 参数预览", WARN, WARN_SOFT, WARN)

    # row 3
    diamond(295, 540, 170, 88, "用户确认？", ACCENT)
    node(500, 510, 210, 78, "取消 / 不执行", "无副作用，返回取消原因", INK2, "#F6F3EC", BORDER)
    node(760, 620, 210, 78, "执行并写 op_log", "来源标记 ai · 可撤销", ACCENT, ACCENT_SOFT, ACCENT)

    # note
    s.rect(72, 648, 560, 70, fill=CARD, stroke=BORDER, rx=12)
    s.text(92, 674, "隐私边界", size=12, weight=700, fill=ACCENT_DEEP)
    s.text(92, 696, "Key 只存 Keychain；按空间最小化发送；日志与导出包不含明文 Key；无遥测。", size=11, fill=INK2)

    # arrows
    s.arrow([(302, 189), (380, 189)])
    s.arrow([(610, 189), (685, 189)])
    s.arrow([(835, 189), (960, 189)], color=SUCCESS, label="是", lp=(900, 176))
    s.arrow([(760, 231), (760, 300), (500, 300), (500, 336)], color=WARN, label="否", lp=(790, 292))
    s.arrow([(585, 380), (680, 380), (680, 459), (760, 459)], color=DANGER, label="是", lp=(620, 368))
    s.arrow([(415, 380), (390, 380)], color=WARN, label="否", lp=(402, 368), label_size=11)
    s.arrow([(295, 418), (295, 496)], color=WARN)
    s.arrow([(380, 540), (500, 540)], color=INK3, label="否", lp=(440, 528))
    s.arrow([(295, 584), (295, 610), (760, 610), (760, 620)], color=ACCENT, label="是", lp=(520, 598))
    s.arrow([(1065, 228), (1065, 300)], color=INFO)

    s.footer()
    save(s, "d6_ai_guardrails.svg")

'''

D8 = r'''def d8():
    s = SVG(1040, 660, "测试策略金字塔", "越往上越慢、越贵；核心风险用契约与属性测试兜底", "QUALITY")
    s.title_block("QUALITY")

    cx = 380
    layers = [
        ("E2E · Playwright", 240, 170, 86, 146, "核心旅程 · WebKit 移动端", ACCENT, ACCENT_SOFT),
        ("契约 / 属性测试", 330, 250, 88, 242, "ops × 4 入口 · 同步收敛", WARN, WARN_SOFT),
        ("集成", 440, 350, 90, 340, "application + SQLite + op_log 事务", INFO, INFO_SOFT),
        ("单元", 560, 460, 92, 440, "聚合不变量 · 状态机 · domain ≥ 90%", SUCCESS, SUCCESS_SOFT),
    ]
    for name, bw, tw_, h, y, desc, tint, bg in layers:
        pts = [(cx - bw / 2, y + h), (cx + bw / 2, y + h), (cx + tw_ / 2, y), (cx - tw_ / 2, y)]
        p = " ".join(f"{x},{yy}" for x, yy in pts)
        s.add(f'<polygon points="{p}" fill="{bg}" stroke="{tint}" stroke-width="1.2" stroke-linejoin="round"/>')
        s.text(cx, y + h / 2 + 2, name, size=14, weight=700, fill=tint, anchor="middle")
        s.text(cx, y + h / 2 + 22, desc, size=10, fill=INK3, anchor="middle")

    notes = [
        ("视觉回归", "关键页面浅色 / 深色 / 平板 / 手机截图"),
        ("可访问性", "axe 扫描 + 键盘全流程"),
        ("性能基线", "1 万任务首屏 ≤1s · 拖拽 60fps"),
        ("测试数据", "隔离数据库 · 固定种子 · 不碰真实数据"),
        ("AI 测试", "mock 供应商 · 护栏断言"),
        ("同步测试", "假文件系统 3 设备属性测试"),
    ]
    y = 146
    for title, desc in notes:
        s.rect(720, y, 232, 58, fill=CARD, stroke=BORDER, rx=10)
        s.text(738, y + 22, title, size=12, weight=700)
        s.text(738, y + 41, desc, size=10, fill=INK3)
        y += 66

    s.text(72, 570, "门禁", size=12, weight=700, fill=ACCENT_DEEP)
    s.text(120, 570, "domain ≥ 90% · 整体 ≥ 60% · PR 必过契约测试 · 同步与恢复属高风险变更，必须演练。", size=11.5, fill=INK2)

    s.footer()
    save(s, "d8_test_pyramid.svg")

'''

# Replace whole functions between markers
def replace_func(src, name, next_marker, new):
    pat = re.compile(rf"def {name}\(\):.*?\n# -+ {next_marker}", re.S)
    assert pat.search(src), f"pattern for {name} not found"
    return pat.sub(new + f"# ---------------------------------------------------------------- {next_marker}", src, count=1)

src = replace_func(src, "d1", "D2 containers", D1)
src = replace_func(src, "d2", "D3 context map", D2)
src = replace_func(src, "d3", "D4 sync flow", D3)
src = replace_func(src, "d6", "D7 CI pipeline", D6)
src = replace_func(src, "d8", "D9 journey loop", D8)

# small fixes
repl = [
    # d4 lanes / callout / canvas
    ('s.rect(56, 122, 380, 470', 's.rect(56, 122, 380, 420'),
    ('s.rect(470, 122, 380, 470', 's.rect(470, 122, 380, 420'),
    ('s.rect(884, 122, 380, 470', 's.rect(884, 122, 380, 420'),
    ('s.rect(80, 566, 1160, 56', 's.rect(80, 560, 1160, 56'),
    ('s.text(100, 590, "重放原则"', 's.text(100, 584, "重放原则"'),
    ('s.text(168, 590, "重复不重放', 's.text(168, 584, "重复不重放'),
    ('s.text(100, 610, "风险', 's.text(100, 604, "风险'),
    ('s = SVG(1320, 660, "iCloud 同步与恢复流程"', 's = SVG(1320, 690, "iCloud 同步与恢复流程"'),
    # d5 remove decorative circle and orthogonal arrows / canvas
    ('    s.circle(620, 380, 110, fill=ACCENT_SOFT, stroke="none", opacity=0.55)\n', ''),
    ('    s.arrow([(338, 275), (520, 350)], color=ACCENT, label=None)\n    s.arrow([(338, 485), (520, 420)], color=SUCCESS, label=None)\n    s.arrow([(902, 275), (720, 350)], color=INFO, label=None)\n    s.arrow([(902, 485), (720, 420)], color=WARN, label=None)\n    s.arrow([(620, 300), (620, 234)], color=ACCENT, label=None)\n',
     '    s.arrow([(338, 275), (410, 275), (410, 350), (520, 350)], color=ACCENT)\n    s.arrow([(338, 485), (420, 485), (420, 420), (520, 420)], color=SUCCESS)\n    s.arrow([(902, 275), (820, 275), (820, 350), (720, 350)], color=INFO)\n    s.arrow([(902, 485), (820, 485), (820, 420), (720, 420)], color=WARN)\n    s.arrow([(620, 310), (620, 234)], color=ACCENT)\n'),
    ('s = SVG(1240, 700, "Ops 目录', 's = SVG(1240, 720, "Ops 目录'),
    # d7 canvas / release card
    ('s = SVG(1320, 500, "CI 与发布流水线"', 's = SVG(1320, 540, "CI 与发布流水线"'),
    ('s.rect(64, 412, 1192, 46', 's.rect(64, 404, 1192, 46'),
    # d9 canvas, bands, return arrow
    ('s = SVG(1240, 560, "核心用户旅程闭环"', 's = SVG(1240, 620, "核心用户旅程闭环"'),
    ('s.rect(64, 400, 1112, 54', 's.rect(64, 420, 1112, 54'),
    ('s.text(84, 433, "AI 助手贯穿"', 's.text(84, 453, "AI 助手贯穿"'),
    ('s.text(180, 433, "自然语言', 's.text(180, 453, "自然语言'),
    ('s.rect(64, 466, 1112, 44', 's.rect(64, 488, 1112, 44'),
    ('s.text(84, 494, "数据闭环"', 's.text(84, 516, "数据闭环"'),
    ('s.text(180, 494, "SQLite', 's.text(180, 516, "SQLite'),
    # d10 canvas / steps / note
    ('s = SVG(1240, 600, "移动端访问链路"', 's = SVG(1240, 640, "移动端访问链路"'),
    ('s.rect(x, 470, 270, 76', 's.rect(x, 456, 270, 76'),
    ('s.circle(x + 22, 492, 11', 's.circle(x + 22, 478, 11'),
    ('s.text(x + 22, 496, n', 's.text(x + 22, 482, n'),
    ('s.text(x + 42, 496, title', 's.text(x + 42, 482, title'),
    ('s.text(x + 18, 524, desc', 's.text(x + 18, 510, desc'),
    ('s.text(72, 568, "边界', 's.text(72, 560, "边界'),
]

for old, new in repl:
    assert old in src, f"missing: {old[:60]}"
    src = src.replace(old, new, 1)

# d9 replace the return loop block
old_loop = '''    s.polyline([(x0 + 4 * (w + gap) + w / 2, y0 + 150), (x0 + 4 * (w + gap) + w / 2, y0 + 220),
                (x0 + w / 2, y0 + 220), (x0 + w / 2, y0 + 150)], color=ACCENT, sw=1.6, dash="6 5")
    s.arrow([(x0 + w / 2 + 1, y0 + 230), (x0 + w / 2, y0 + 160)], color=ACCENT, sw=0.1)
    s.text(x0 + 2.2 * (w + gap), y0 + 210, "每天循环 · 周复盘回灌下周计划", size=11, fill=ACCENT_DEEP, anchor="middle")'''
new_loop = '''    s.arrow([(x0 + 4 * (w + gap) + w / 2, y0 + 150), (x0 + 4 * (w + gap) + w / 2, y0 + 190),
             (x0 + w / 2, y0 + 190), (x0 + w / 2, y0 + 150)], color=ACCENT, sw=1.6, dash="6 5",
            label="每天循环 · 周复盘回灌下周计划", lp=(x0 + 2.2 * (w + gap), y0 + 182), label_size=11)'''
assert old_loop in src, "d9 loop block missing"
src = src.replace(old_loop, new_loop, 1)

# add inbox icon case
old_icon = '''        if kind == "window":'''
new_icon = '''        if kind == "inbox":
            self.add(f'<path d="M{x} {y+3*s} L{x+26*s} {y+3*s} L{x+26*s} {y+24*s} L{x} {y+24*s} Z" '
                     f'fill="none" stroke="{color}" stroke-width="1.6" stroke-linejoin="round"/>')
            self.add(f'<path d="M{x} {y+14*s} L{x+8*s} {y+14*s} L{x+11*s} {y+19*s} L{x+15*s} {y+19*s} '
                     f'L{x+18*s} {y+14*s} L{x+26*s} {y+14*s}" fill="none" stroke="{color}" stroke-width="1.6" stroke-linejoin="round"/>')
        elif kind == "window":'''
assert old_icon in src, "icon anchor missing"
src = src.replace(old_icon, new_icon, 1)

open(P, "w", encoding="utf-8").write(src)
print("patched")
