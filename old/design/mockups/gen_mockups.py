#!/usr/bin/env python3
"""Generate high-fidelity HTML design mockups for Dailywork."""
import os

OUT = os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)

ICONS = {
    "home": '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    "inbox": '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 13h5l2 3h2l2-3h5"/>',
    "calendar": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
    "kanban": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
    "quad": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    "chart": '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    "doc": '<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h4M9 12h6M9 16h6"/>',
    "timer": '<circle cx="12" cy="13" r="8"/><path d="M12 13V9M9 2h6"/>',
    "search": '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    "bell": '<path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "flag": '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "clip": '<path d="M21 11.5l-8.5 8.5a5 5 0 01-7-7L14 4.5a3.5 3.5 0 015 5L10 18.5a2 2 0 01-3-3l8-8"/>',
    "chevron": '<path d="M9 6l6 6-6 6"/>',
    "more": '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',
    "check": '<path d="M20 6L9 17l-5-5"/>',
    "spark": '<path d="M12 3l2 6 6 3-6 3-2 6-2-6-6-3 6-3z"/>',
    "settings": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1-1.4 2.4-.2-.1a1.7 1.7 0 00-1.9.3 1.7 1.7 0 00-.7 1.8V22h-2.8v-.1a1.7 1.7 0 00-.7-1.8 1.7 1.7 0 00-1.9-.3l-.2.1L7.6 17l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.6-1H6v-2.8h.4a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9L7.6 8 9 5.6l.2.1a1.7 1.7 0 001.9-.3 1.7 1.7 0 00.7-1.8V3.5h2.8v.1a1.7 1.7 0 00.7 1.8 1.7 1.7 0 001.9.3l.2-.1L18.8 8l-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.6 1h.4V14h-.4a1.7 1.7 0 00-1.6 1z"/>',
}
SPACE_COLORS = {"work": "#D97757", "study": "#6A9BCC", "life": "#788C5D"}


def icon(name, size=16, color="currentColor", sw=1.7):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</svg>')


def dot(color, size=7):
    return f'<span class="dot" style="background:{color};width:{size}px;height:{size}px"></span>'


def chip(text, color="#5B5750", bg="#F6F3EC"):
    return f'<span class="chip" style="color:{color};background:{bg}">{text}</span>'


def ring(percent, size=44, stroke=5, color="#D97757", track="#EFE9DD", label=None):
    r = (size - stroke) / 2
    c = 2 * 3.14159 * r
    off = c * (1 - percent / 100)
    txt = label if label is not None else f"{percent}%"
    return (f'<div class="ring" style="width:{size}px;height:{size}px">'
            f'<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}">'
            f'<circle cx="{size/2}" cy="{size/2}" r="{r}" fill="none" stroke="{track}" stroke-width="{stroke}"/>'
            f'<circle cx="{size/2}" cy="{size/2}" r="{r}" fill="none" stroke="{color}" stroke-width="{stroke}" '
            f'stroke-linecap="round" stroke-dasharray="{c:.1f}" stroke-dashoffset="{off:.1f}" '
            f'transform="rotate(-90 {size/2} {size/2})"/>'
            f'</svg><span class="ring-label" style="font-size:{size*0.24:.1f}px">{txt}</span></div>')


def sidebar(active):
    groups = [
        ("项目", [
            ("box", "项目概览", ""), ("gauge", "每日容量", ""), ("inbox", "收件箱", "3"),
            ("check", "交付成果", ""), ("refresh", "完成复盘", ""), ("moon", "每日收尾", ""),
            ("template", "模板库", ""), ("history", "操作历史", ""),
        ]),
        ("计划", [("timeline", "时间轴", ""), ("calendar", "日历", "")]),
        ("任务", [("home", "今天", "6"), ("list", "全部任务", ""), ("kanban", "看板", ""), ("quad", "四象限", "")]),
    ]
    nav = ""
    for title, items in groups:
        nav += f'<div class="nav-title">{title}</div>'
        for ic, name, count in items:
            cls = "nav-item active" if name == active else "nav-item"
            badge = f'<span class="nav-count">{count}</span>' if count else ""
            icon_name = ic if ic in ICONS else {"box": "kanban", "gauge": "chart", "check": "doc",
                                                "refresh": "timer", "moon": "home", "template": "doc",
                                                "history": "clock", "timeline": "calendar", "list": "kanban"}.get(ic, "doc")
            nav += f'<div class="{cls}">{icon(icon_name)}<span>{name}</span>{badge}</div>'
    spaces = ""
    for name, color, count in [("工作", SPACE_COLORS["work"], 2), ("学习", SPACE_COLORS["study"], 2), ("生活", SPACE_COLORS["life"], 1)]:
        spaces += f'<div class="nav-item space-item">{dot(color, 8)}<span>{name}</span><span class="nav-count">{count}</span></div>'
    return f'''
<aside class="sidebar">
  <div class="brand">
    <div class="brand-mark"><img src="logo-carton.png" alt=""></div>
    <div><div class="brand-name">时序</div><div class="brand-sub">Dailywork</div></div>
    <div class="brand-collapse">{icon("chevron", 14, "#8A857D")}</div>
  </div>
  <nav class="nav">{nav}
    <div class="nav-title space-title">空间 <span class="nav-plus">+</span></div>
    {spaces}
  </nav>
  <div class="sidebar-foot">
    <div class="foot-card">
      <div>{ring(17, 38, 4)}</div>
      <div><div class="foot-title">今日进度</div><div class="foot-sub">已完成 1 项任务</div></div>
    </div>
  </div>
</aside>'''


def topbar(crumb, search="搜索任务、项目、文档…", action="新建任务"):
    return f'''
<header class="topbar">
  <div class="crumb">{crumb}</div>
  <div class="search"><span class="search-icon">{icon("search", 15)}</span><span class="search-text">{search}</span><span class="kbd">⌘ K</span></div>
  <div class="top-actions">
    <button class="icon-btn" title="通知">{icon("bell", 17)}<i class="notice-dot"></i></button>
    <button class="icon-btn" title="主题">{icon("sun", 17)}</button>
    <button class="primary-btn">{icon("plus", 15, "#fff", 2)}<span>{action}</span></button>
  </div>
</header>'''


def page(title, body, active="今天", crumb="任务 / 今天", drawer="", body_class=""):
    return f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>{title}</title><link rel="stylesheet" href="styles.css"></head>
<body class="{body_class}">
<div class="app">
{sidebar(active)}
<div class="workspace">
{topbar(crumb)}
<div class="content-row">
<main class="main">{body}</main>
{drawer}
</div>
</div>
</div>
</body></html>'''


def drawer_task():
    return f'''
<aside class="drawer">
  <div class="drawer-tabs"><span class="tab active">详情</span><span class="tab">子待办 <b>2</b></span><span class="tab">记录</span>
    <span class="drawer-actions">{icon("more", 16)}</span></div>
  <div class="drawer-head">
    <span class="status-radio doing"></span>
    <h2>整理 2.0.11 发布截图</h2>
    <div class="drawer-tools">{icon("chevron", 14)}</div>
  </div>
  <div class="field-list">
    <div class="field"><span class="f-label">{icon("inbox", 14)} 空间</span><span class="f-value space-work">{dot(SPACE_COLORS["work"], 7)} 工作</span></div>
    <div class="field"><span class="f-label">{icon("calendar", 14)} 日期</span><span class="f-value">今天</span></div>
    <div class="field"><span class="f-label">{icon("clock", 14)} 时间</span><span class="f-value">10:40–12:10 · 1 小时 30 分钟</span></div>
    <div class="field"><span class="f-label">{icon("timer", 14)} 执行</span><span class="f-value"><span class="run-pill">▶ 进行中</span></span></div>
    <div class="field"><span class="f-label">{icon("flag", 14)} 优先级</span><span class="f-value priority-high">高优先级</span></div>
    <div class="field"><span class="f-label">{icon("doc", 14)} 项目</span><span class="f-value">新版发布与交付</span></div>
    <div class="field"><span class="f-label">{icon("chart", 14)} 预估</span><span class="f-value">90 分钟 · 已分配 90 分钟</span></div>
  </div>
  <div class="section-label">备注</div>
  <div class="note-box">保持软件截图清晰，不拉伸、不遮挡关键按钮。</div>
  <div class="attach-row"><span class="attach-btn">{icon("clip", 14)} 粘贴图片</span><span class="attach-btn">{icon("clip", 14)} 添加附件</span><span class="attach-count">0/12</span></div>
  <div class="focus-card">
    <div class="focus-head"><span>{icon("timer", 15)} 专注空间</span><span>{icon("chevron", 13)}</span></div>
    <div class="focus-options"><span>15</span><span class="on">25</span><span>45</span><span>60</span><span class="focus-min">25 分钟</span></div>
    <div class="focus-bottom">{ring(0, 54, 5, "#D97757", "#EFE9DD", "25:00")}<span>开始一段专注</span></div>
  </div>
</aside>'''


def task_row(status, title, proj, time, meta, estimate, prio="", sub=""):
    cls = {"doing": "doing", "waiting": "waiting", "blocked": "blocked", "done": "done", "next": "next"}[status]
    return f'''
<div class="task-row">
  <span class="status-radio {cls}"></span>
  <div class="task-main"><div class="task-title">{title}</div><div class="task-sub">{proj} · {time}</div></div>
  {sub}
  <div class="task-meta">{meta}</div>
  <div class="task-est">{estimate}</div>
  {f'<span class="prio-flag">{prio}</span>' if prio else ''}
  <span class="row-arrow">{icon("chevron", 13)}</span>
</div>'''


# ---------------------------------------------------------------- today
def today():
    body = f'''
<div class="page-head">
  <div><h1>今天</h1><p class="page-sub">10月27日 星期二 · 待处理 5 项</p></div>
  <div class="head-right"><div class="progress-card"><div class="progress-copy"><b>1 / 6</b><span>今日完成</span></div>{ring(17, 48, 5)}</div></div>
</div>
<div class="view-tabs"><span class="active">行动清单</span><span>时间轴</span><span>看板</span><span>四象限</span><span class="view-spacer"></span><span class="filter-chip">全部</span><span class="filter-chip">工作</span><span class="filter-chip">学习</span><span class="filter-chip">生活</span><span class="filter-chip">{icon("search", 13)} 筛选</span></div>
<div class="group-label"><span>今天</span><span class="group-count">3</span></div>
<div class="list-card">
{task_row("next", "确认新版首页信息层级", "新版发布与交付", "2026-10-27", chip("工作") + chip("高优"), "未估算", "高")}
{task_row("doing", "整理 2.0.11 发布截图", "新版发布与交付", "10:40–12:10", chip("工作") + chip("进行中", "#C6613F", "#F4E5DD"), "90 分钟", "高")}
{task_row("waiting", "等待客户确认最终文案", "新版发布与交付", "12:10–17:30", chip("工作") + chip("等待中", "#A8761C", "#F7EFDF"), "未估算")}
</div>
<div class="group-label"><span>下一步</span><span class="group-count">2</span></div>
<div class="list-card">
{task_row("next", "完成安装包交付与验收", "新版发布与交付", "今天", chip("工作"), "30 分钟")}
{task_row("next", "复习数量关系错题", "备考计划", "19:30–20:00", chip("学习", "#4C6E8F", "#EAF1F7") + chip("子任务 1/2"), "30 分钟")}
</div>'''
    return page("今天 · 时序", body, active="今天", crumb="任务 / 今天", drawer=drawer_task())


# ---------------------------------------------------------------- kanban
def kanban():
    def card(space, color, title, proj, meta, sub, flags=False):
        return f'''
<div class="kb-card">
  <div class="kb-top">{chip(space, color, "#F6F3EC")}{f'<span class="kb-flags">{icon("flag", 11, "#B5473C")}</span>' if flags else ''}</div>
  <div class="kb-title">{title}</div>
  {f'<div class="kb-sub">{sub}</div>' if sub else ''}
  <div class="kb-meta"><span>{icon("clock", 12)} {meta}</span>{'<span class="kb-progress">1/2 子待办</span>' if flags else ''}</div>
</div>'''
    body = f'''
<div class="page-head">
  <div><h1>今天</h1><p class="page-sub">10月27日 星期二 · 待处理 5 项</p></div>
  <div class="head-right"><div class="progress-card"><div class="progress-copy"><b>1 / 6</b><span>今日完成</span></div>{ring(17, 48, 5)}</div></div>
</div>
<div class="view-tabs"><span>行动清单</span><span>时间轴</span><span class="active">看板</span><span>四象限</span><span class="view-spacer"></span><span class="filter-chip">全部</span><span class="filter-chip">工作</span><span class="filter-chip">学习</span><span class="filter-chip">生活</span></div>
<div class="kanban">
  <div class="kb-col"><div class="kb-head"><span>{dot("#8A857D")} 下一步</span><span class="kb-count">2</span><span class="kb-plus">+</span></div>
    {card("学习", "#4C6E8F", "精读英语阅读第18篇", "备考计划", "20:05–20:35", "只整理长难句，不逐词抄写。")}
    {card("生活", "#788C5D", "整理下周采购清单", "生活", "20:40–21:00", "厨房用品与打印纸。")}
  </div>
  <div class="kb-col"><div class="kb-head"><span>{dot("#D97757")} 进行中</span><span class="kb-count">2</span><span class="kb-plus">+</span></div>
    <div class="kb-card selected">
      <div class="kb-top">{chip("工作", "#D97757", "#F4E5DD")}<span class="kb-flags">{icon("flag", 11, "#B5473C")}</span></div>
      <div class="kb-title">整理 2.0.11 发布截图</div>
      <div class="kb-sub">保持软件截图清晰，不拉伸，不遮挡关键按钮。</div>
      <div class="kb-meta"><span>{icon("clock", 12)} 10:40–12:10</span><span class="kb-progress">1/2 子待办</span></div>
    </div>
    {card("学习", "#4C6E8F", "复习数量关系错题", "备考计划", "19:30–20:00", "先重做昨天标记的 5 道题，再核对错因。", True)}
  </div>
  <div class="kb-col"><div class="kb-head"><span>{dot("#A8761C")} 等待中</span><span class="kb-count">1</span><span class="kb-plus">+</span></div>
    {card("工作", "#D97757", "等待客户确认最终文案", "新版发布与交付", "12:10–17:30", "明天 10 点未回复则主动跟进。")}
  </div>
</div>'''
    return page("看板 · 时序", body, active="看板", crumb="任务 / 看板", drawer=drawer_task())


# ---------------------------------------------------------------- calendar
def calendar():
    # simple month grid October 2026 (starts Thursday)
    cells = []
    for i in range(4):
        cells.append('<div class="cal-cell empty"></div>')
    for d in range(1, 32):
        events = {
            1: [("工作", "#D97757")], 2: [("学习", "#4C6E8F")],
            6: [("工作", "#D97757"), ("生活", "#788C5D")], 8: [("学习", "#4C6E8F")],
            13: [("工作", "#D97757")], 15: [("学习", "#4C6E8F"), ("生活", "#788C5D")],
            20: [("工作", "#D97757")], 22: [("学习", "#4C6E8F")], 26: [("生活", "#788C5D")],
            27: [("工作", "#D97757"), ("学习", "#4C6E8F"), ("生活", "#788C5D")],
            28: [("工作", "#D97757")], 30: [("学习", "#4C6E8F")],
        }.get(d, [])
        ev = "".join(f'<span class="cal-ev" style="background:{c}1A;color:{c}">{n}</span>' for n, c in events[:2])
        cls = "cal-cell today" if d == 27 else "cal-cell"
        cells.append(f'<div class="{cls}"><span class="cal-num">{d}</span>{ev}</div>')
    grid = "".join(cells[:35])
    agenda = [
        ("09:30–10:30", "确认新版首页信息层级", "工作", "#D97757", "已完成"),
        ("10:40–12:10", "整理 2.0.11 发布截图", "工作", "#D97757", "进行中"),
        ("12:10–17:30", "等待客户确认最终文案", "工作", "#A8761C", "等待中"),
        ("19:30–20:00", "复习数量关系错题", "学习", "#4C6E8F", "进行中"),
        ("20:05–20:35", "精读英语阅读第18篇", "学习", "#4C6E8F", "待开始"),
        ("20:40–21:00", "整理下周采购清单", "生活", "#788C5D", "待开始"),
    ]
    agenda_html = "".join(f'''
<div class="agenda-item"><div class="agenda-time">{t}</div><div class="agenda-dot" style="background:{c}"></div>
<div class="agenda-main"><div class="agenda-title">{title}</div><div class="agenda-sub">{space} · {state}</div></div></div>''' for t, title, space, c, state in agenda)
    body = f'''
<div class="page-head">
  <div><h1>日历</h1><p class="page-sub">按周、月或年查看任务安排</p></div>
  <div class="segmented"><span>周</span><span class="on">月</span><span>年</span><span class="seg-nav">‹</span><span class="seg-date">2026 年 10 月</span><span class="seg-nav">›</span></div>
</div>
<div class="cal-wrap">
  <div class="cal-card">
    <div class="cal-week"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
    <div class="cal-grid">{grid}</div>
  </div>
  <aside class="agenda">
    <div class="agenda-head"><div><div class="agenda-eyebrow">今天</div><h3>6 项安排</h3></div><span class="agenda-count">6 项</span></div>
    <div class="agenda-search">{icon("search", 13)} 搜索当日安排</div>
    <div class="agenda-list">{agenda_html}</div>
  </aside>
</div>'''
    return page("日历 · 时序", body, active="日历", crumb="计划 / 日历", body_class="calendar-page")


# ---------------------------------------------------------------- dashboard
def dashboard():
    weeks = [("7/28", 12), ("8/4", 18), ("8/11", 15), ("8/18", 22), ("8/25", 26), ("9/1", 20),
             ("9/8", 28), ("9/15", 24), ("9/22", 31), ("9/29", 27), ("10/6", 34), ("10/13", 38)]
    bars = ""
    maxv = max(v for _, v in weeks)
    for i, (label, v) in enumerate(weeks):
        h = v / maxv * 130
        cls = "bar current" if i == len(weeks) - 1 else "bar"
        bars += f'<div class="bar-col"><div class="{cls}" style="height:{h:.0f}px"></div><span>{label}</span></div>'
    attention = [
        ("danger", "3 个任务已逾期", "最早逾期 2 天 · 都在「新版发布与交付」"),
        ("warn", "2 个任务等待外部", "客户文案确认 · 设计素材"),
        ("info", "本周专注 12h 30m", "比上周多 2h 10m"),
    ]
    att = "".join(f'<div class="attention-item"><span class="att-ico {cls}"></span><div><div class="att-title">{t}</div><div class="att-sub">{s}</div></div>{icon("chevron", 13, "#8A857D")}</div>' for cls, t, s in attention)
    body = f'''
<div class="page-head">
  <div><h1>仪表盘</h1><p class="page-sub">10月21日 – 10月27日 · 本周概览</p></div>
  <div class="head-right"><span class="filter-chip">本周</span><span class="filter-chip">全部空间</span><button class="ghost-btn">导出</button></div>
</div>
<div class="dash-grid">
  <section class="dash-hero">
    <div class="hero-copy"><div class="hero-eyebrow">本周完成率</div><div class="hero-num">68<span>%</span></div><div class="hero-sub">完成 34 / 50 项 · 比上周 +6%</div></div>
    <div class="hero-ring">{ring(68, 150, 10, "#D97757", "#EFE9DD", "34/50")}</div>
    <div class="hero-side">
      <div class="mini-stat"><span class="mini-label">专注时长</span><b>12h 30m</b><span class="mini-delta up">+21%</span></div>
      <div class="mini-stat"><span class="mini-label">连续完成</span><b>12 天</b><span class="mini-delta">最佳 21 天</span></div>
      <div class="mini-stat"><span class="mini-label">逾期</span><b>3</b><span class="mini-delta down">需要关注</span></div>
    </div>
  </section>
  <section class="dash-card kpi-card">
    <div class="card-head"><span>12 周完成趋势</span><span class="card-more">{icon("more", 14)}</span></div>
    <div class="bar-chart">{bars}</div>
    <div class="chart-foot"><span>周完成数</span><span class="legend-dot"></span><span>本周 38 项</span></div>
  </section>
  <section class="dash-card insight-card">
    <div class="insight-badge">模式发现</div>
    <div class="insight-num">+42<span>%</span></div>
    <div class="insight-title">周三的专注时长最高</div>
    <p>过去 60 天里，你在周三平均专注 2h 40m，比全周平均高 42%。可以把高难度任务安排在这一天。</p>
    <button class="insight-btn">查看专注记录 →</button>
  </section>
  <section class="dash-card waterfall-card">
    <div class="card-head"><span>时间都花在哪</span><span class="card-sub">本周 50 项任务</span></div>
    <div class="wf-row"><span class="wf-label">已完成</span><div class="wf-track"><i style="width:68%;background:#788C5D"></i></div><span class="wf-val">34</span></div>
    <div class="wf-row"><span class="wf-label">进行中</span><div class="wf-track"><i style="width:18%;background:#D97757"></i></div><span class="wf-val">9</span></div>
    <div class="wf-row"><span class="wf-label">等待中</span><div class="wf-track"><i style="width:8%;background:#A8761C"></i></div><span class="wf-val">4</span></div>
    <div class="wf-row"><span class="wf-label">受阻/逾期</span><div class="wf-track"><i style="width:6%;background:#B5473C"></i></div><span class="wf-val">3</span></div>
    <div class="wf-note">工作占 62%，学习占 26%，生活占 12%。</div>
  </section>
  <section class="dash-card attention-card">
    <div class="card-head"><span>需要关注</span><span class="card-sub">3 类</span></div>
    <div class="attention-list">{att}</div>
  </section>
  <section class="dash-card focus-week">
    <div class="card-head"><span>专注分布</span><span class="card-sub">按空间</span></div>
    <div class="donut-wrap">
      <div class="donut"></div>
      <div class="donut-legend">
        <div><span style="background:#D97757"></span>工作 <b>62%</b></div>
        <div><span style="background:#6A9BCC"></span>学习 <b>26%</b></div>
        <div><span style="background:#788C5D"></span>生活 <b>12%</b></div>
      </div>
    </div>
  </section>
</div>'''
    return page("仪表盘 · 时序", body, active="仪表盘", crumb="分析 / 仪表盘", body_class="dashboard-page")


# ---------------------------------------------------------------- project
def project():
    body = f'''
<div class="page-head">
  <div><h1>项目与安排</h1><p class="page-sub">项目 1 个 · 活动任务 6 项</p></div>
  <div class="head-right"><button class="primary-btn">{icon("plus", 15, "#fff", 2)}<span>新建项目</span></button></div>
</div>
<div class="project-head">
  <div class="project-title-row"><span class="project-icon">{icon("kanban", 18, "#C6613F")}</span><div><h2>新版发布与交付</h2><p>清楚展示新界面和关键流程</p></div><span class="project-status">进行中</span></div>
  <div class="project-meta"><span>{chip("工作", "#D97757", "#F4E5DD")}</span><span>截止 2026-10-30</span><span>验收：截图清晰、功能可见、交付可追溯</span><button class="ghost-btn">结束并归档</button></div>
</div>
<div class="stat-strip">
  <div class="stat"><span>任务</span><b>4</b></div><div class="stat"><span>已完成</span><b class="green">1</b></div>
  <div class="stat"><span>等待</span><b class="amber">1</b></div><div class="stat"><span>受阻</span><b class="red">1</b></div>
  <div class="stat wide"><span>按任务数</span><div class="progress"><i style="width:25%"></i></div><b class="pct">25%</b></div>
</div>
<div class="project-tools"><span class="tool-link">任务模板</span><span class="tool-link">常用筛选</span><span class="tool-link">交付成果</span><span class="tool-spacer"></span><span class="filter-chip">{icon("search", 13)} 搜索任务</span><span class="filter-chip">全部状态</span><span class="filter-chip">+ 添加任务</span></div>
<div class="list-card">
{task_row("done", "确认新版首页信息层级", "新版发布与交付", "2026-10-27", chip("工作") + chip("已完成", "#5E7048", "#EEF1E7"), "未估算", "高")}
{task_row("doing", "整理 2.0.11 发布截图", "新版发布与交付", "10:40–12:10", chip("工作") + chip("进行中", "#C6613F", "#F4E5DD"), "90 分钟", "高")}
{task_row("waiting", "等待客户确认最终文案", "新版发布与交付", "12:10–17:30", chip("工作") + chip("等待中", "#A8761C", "#F7EFDF"), "未估算")}
{task_row("next", "完成安装包交付与验收", "新版发布与交付", "明天", chip("工作"), "30 分钟")}
</div>'''
    return page("项目与安排 · 时序", body, active="项目概览", crumb="项目 / 项目与安排", drawer=drawer_task())


# ---------------------------------------------------------------- document
def document():
    body = f'''
<div class="doc-layout">
  <aside class="doc-tree">
    <div class="tree-head"><span>文档</span><span class="tree-plus">+</span></div>
    <div class="tree-search">{icon("search", 13)} 搜索文档</div>
    <div class="tree-group">工作</div>
    <div class="tree-item active">{icon("doc", 14)} 2.0.11 发布计划</div>
    <div class="tree-item">{icon("doc", 14)} 发布检查单</div>
    <div class="tree-item">{icon("doc", 14)} 客户反馈汇总</div>
    <div class="tree-group">学习</div>
    <div class="tree-item">{icon("doc", 14)} 英语长难句笔记</div>
    <div class="tree-item">{icon("doc", 14)} 数量关系错题本</div>
  </aside>
  <article class="editor">
    <div class="editor-top"><span class="editor-icon">{icon("doc", 18, "#C6613F")}</span><div class="editor-meta"><span>工作</span><span>·</span><span>上次编辑 3 分钟前</span><span class="saved">已自动保存</span></div><button class="ghost-btn">导出</button></div>
    <h1 class="doc-title">2.0.11 发布计划</h1>
    <div class="doc-tags">{chip("发布")}{chip("截图")}{chip("验收")}</div>
    <div class="doc-body">
      <p>本周目标是完成 2.0.11 的发布准备：确认首页信息层级、整理发布截图、完成安装包交付与验收。所有截图需要保持清晰，不拉伸、不遮挡关键按钮。</p>
      <h2>发布前检查</h2>
      <div class="check-line done"><span class="check-box">{icon("chevron", 12, "#fff")}</span><span>确认新版首页信息层级</span></div>
      <div class="check-line"><span class="check-box empty"></span><span>整理 2.0.11 发布截图</span></div>
      <div class="check-line"><span class="check-box empty"></span><span>完成安装包交付与验收</span></div>
      <h2>时间安排</h2>
      <table class="doc-table"><thead><tr><th>事项</th><th>负责人</th><th>截止</th></tr></thead><tbody>
        <tr><td>发布截图</td><td>我</td><td>10-28</td></tr>
        <tr><td>客户文案确认</td><td>客户</td><td>10-29</td></tr>
        <tr><td>安装包验收</td><td>我</td><td>10-30</td></tr>
      </tbody></table>
      <div class="doc-callout"><b>注意</b> 截图统一使用 1440×900、2x 导出；不要使用深色主题截图作为发布主图。</div>
      <p>相关任务：<span class="task-ref">{icon("check", 12, "#C6613F")} 整理 2.0.11 发布截图</span></p>
    </div>
    <div class="ai-bar"><span>{icon("spark", 14, "#C6613F")}</span><span>润色</span><span>摘要</span><span>翻译</span><span>提取待办</span></div>
  </article>
  <aside class="doc-outline">
    <div class="outline-title">目录</div>
    <div class="outline-item active">2.0.11 发布计划</div>
    <div class="outline-item">发布前检查</div>
    <div class="outline-item">时间安排</div>
    <div class="outline-meta">1,240 字 · 3 分钟阅读</div>
  </aside>
</div>'''
    return page("文档 · 时序", body, active="文档中心", crumb="知识 / 文档中心", body_class="doc-page")


# ---------------------------------------------------------------- focus
def focus():
    body = f'''
<div class="focus-screen">
  <div class="focus-nav"><span class="focus-brand">{icon("timer", 18, "#C6613F")} 专注空间</span><span class="focus-close">退出专注</span></div>
  <div class="focus-center">
    <div class="focus-task">{chip("工作", "#D97757", "#F4E5DD")} 整理 2.0.11 发布截图</div>
    {ring(25, 300, 12, "#D97757", "#EFE9DD", "18:42")}
    <div class="focus-caption">本轮 25 分钟 · 已专注 6 分 18 秒</div>
    <div class="focus-controls"><button class="ghost-btn">暂停</button><button class="primary-btn">结束本轮</button></div>
    <div class="focus-durations"><span>15</span><span class="on">25</span><span>45</span><span>60</span></div>
  </div>
  <div class="focus-history">
    <div class="fh-head">今天的专注 <span>3 轮 · 1 小时 15 分</span></div>
    <div class="fh-item"><span class="fh-dot" style="background:#D97757"></span><span>整理 2.0.11 发布截图</span><b>25 分钟</b></div>
    <div class="fh-item"><span class="fh-dot" style="background:#6A9BCC"></span><span>复习数量关系错题</span><b>25 分钟</b></div>
    <div class="fh-item"><span class="fh-dot" style="background:#788C5D"></span><span>精读英语阅读第18篇</span><b>25 分钟</b></div>
  </div>
</div>'''
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>专注 · 时序</title><link rel="stylesheet" href="styles.css"></head>
<body class="focus-body">{body}</body></html>'''


# ---------------------------------------------------------------- mobile today
def mobile_today():
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>今天 · 移动端</title><link rel="stylesheet" href="styles.css"></head>
<body class="mobile-body">
<div class="mobile">
  <div class="m-status"><span>9:41</span><span>●●● ⏻</span></div>
  <div class="m-head"><div><div class="m-hello">10月27日 周二</div><h1>今天</h1></div>{ring(17, 46, 5)}</div>
  <div class="m-search">{icon("search", 14)} 搜索任务、项目…</div>
  <div class="m-tabs"><span class="on">行动清单</span><span>时间轴</span><span>看板</span></div>
  <div class="m-group">今天 <span>3</span></div>
  <div class="m-list">
    <div class="m-task"><span class="status-radio next"></span><div><b>确认新版首页信息层级</b><small>工作 · 高优先级</small></div><span class="m-chev">{icon("chevron", 14)}</span></div>
    <div class="m-task active"><span class="status-radio doing"></span><div><b>整理 2.0.11 发布截图</b><small>工作 · 10:40–12:10</small></div><span class="m-chev">{icon("chevron", 14)}</span></div>
    <div class="m-task"><span class="status-radio waiting"></span><div><b>等待客户确认最终文案</b><small>工作 · 等待中</small></div><span class="m-chev">{icon("chevron", 14)}</span></div>
  </div>
  <div class="m-group">下一步 <span>2</span></div>
  <div class="m-list">
    <div class="m-task"><span class="status-radio next"></span><div><b>完成安装包交付与验收</b><small>工作 · 30 分钟</small></div><span class="m-chev">{icon("chevron", 14)}</span></div>
    <div class="m-task"><span class="status-radio next"></span><div><b>复习数量关系错题</b><small>学习 · 1/2 子待办</small></div><span class="m-chev">{icon("chevron", 14)}</span></div>
  </div>
  <div class="m-fab">+</div>
  <div class="m-tabbar">
    <div class="on">{icon("home", 20)}<span>今天</span></div>
    <div>{icon("calendar", 20)}<span>计划</span></div>
    <div>{icon("kanban", 20)}<span>看板</span></div>
    <div>{icon("doc", 20)}<span>文档</span></div>
    <div>{icon("more", 20)}<span>更多</span></div>
  </div>
</div></body></html>'''


# ---------------------------------------------------------------- mobile dashboard
def mobile_dashboard():
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>仪表盘 · 移动端</title><link rel="stylesheet" href="styles.css"></head>
<body class="mobile-body">
<div class="mobile">
  <div class="m-status"><span>9:41</span><span>●●● ⏻</span></div>
  <div class="m-head"><div><div class="m-hello">本周概览</div><h1>仪表盘</h1></div>{ring(68, 46, 5)}</div>
  <div class="m-hero">
    <div class="m-hero-copy"><span>本周完成率</span><b>68%</b><small>完成 34 / 50 项 · 比上周 +6%</small></div>
    <div class="m-hero-ring">{ring(68, 92, 8, "#D97757", "#EFE9DD", "34/50")}</div>
  </div>
  <div class="m-kpis">
    <div><span>专注时长</span><b>12h 30m</b><small class="up">+21%</small></div>
    <div><span>连续完成</span><b>12 天</b><small>最佳 21 天</small></div>
    <div><span>逾期</span><b class="red">3</b><small class="down">需要关注</small></div>
  </div>
  <div class="m-card"><div class="m-card-head">12 周完成趋势 <span>本周 38 项</span></div>
    <div class="m-bars">
      <i style="height:32%"></i><i style="height:46%"></i><i style="height:38%"></i><i style="height:58%"></i><i style="height:68%"></i><i style="height:52%"></i><i style="height:74%"></i><i style="height:62%"></i><i style="height:82%"></i><i style="height:70%"></i><i style="height:90%"></i><i class="on" style="height:100%"></i>
    </div>
  </div>
  <div class="m-insight"><span>模式发现</span><b>+42%</b><p>周三的专注时长最高，可以把高难度任务安排在这一天。</p></div>
  <div class="m-card"><div class="m-card-head">需要关注</div>
    <div class="m-att"><span class="att-ico danger"></span><div><b>3 个任务已逾期</b><small>最早逾期 2 天</small></div></div>
    <div class="m-att"><span class="att-ico warn"></span><div><b>2 个任务等待外部</b><small>客户文案 · 设计素材</small></div></div>
  </div>
  <div class="m-tabbar">
    <div>{icon("home", 20)}<span>今天</span></div>
    <div>{icon("calendar", 20)}<span>计划</span></div>
    <div>{icon("kanban", 20)}<span>看板</span></div>
    <div>{icon("doc", 20)}<span>文档</span></div>
    <div>{icon("more", 20)}<span>更多</span></div>
  </div>
</div></body></html>'''


CSS = r'''
:root{
  --bg:#FAF9F5; --sunken:#F0EEE6; --card:#FFFFFF; --line:#E8E6DC; --line-strong:#D6D2C4;
  --ink:#141413; --ink2:#5B5750; --ink3:#8A857D; --accent:#D97757; --accent-deep:#C6613F;
  --accent-soft:#F4E5DD; --green:#788C5D; --amber:#A8761C; --red:#B5473C; --blue:#6A9BCC;
  --radius:10px; --shadow:0 1px 2px rgba(25,25,25,.04),0 4px 16px rgba(25,25,25,.05);
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Inter","PingFang SC","Noto Sans SC",sans-serif;font-size:14px;-webkit-font-smoothing:antialiased}
body{overflow:hidden}
.app{width:1440px;height:900px;display:flex;background:var(--bg)}
.sidebar{width:248px;flex:none;background:var(--sunken);border-right:1px solid var(--line);display:flex;flex-direction:column;padding:18px 14px 14px}
.brand{display:flex;align-items:center;gap:10px;padding:2px 6px 18px}
.brand-mark{width:34px;height:34px;display:flex;align-items:center;justify-content:center;flex:none}
.brand-mark img{width:100%;height:100%;object-fit:contain;display:block}
.brand-name{font-size:15px;font-weight:700;letter-spacing:.3px}
.brand-sub{font-size:10px;color:var(--ink3);margin-top:1px;letter-spacing:.2px}
.brand-collapse{margin-left:auto;opacity:.6}
.nav{flex:1;overflow:hidden}
.nav-title{font-size:10.5px;color:var(--ink3);font-weight:600;padding:14px 10px 6px;letter-spacing:.4px}
.space-title{display:flex;align-items:center}
.nav-plus{margin-left:auto;font-size:15px;color:var(--ink3);font-weight:400}
.nav-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;color:var(--ink2);font-size:13px;margin:1px 0;cursor:default}
.nav-item svg{opacity:.75}
.nav-item.active{background:var(--card);color:var(--ink);font-weight:600;border:1px solid var(--line);box-shadow:0 1px 2px rgba(25,25,25,.03)}
.nav-item.active svg{opacity:1;color:var(--accent-deep)}
.nav-count{margin-left:auto;font-size:10.5px;color:var(--ink3);font-variant-numeric:tabular-nums}
.space-item{gap:9px}
.sidebar-foot{padding-top:12px}
.foot-card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:flex;align-items:center;gap:10px}
.foot-title{font-size:12px;font-weight:600}
.foot-sub{font-size:10.5px;color:var(--ink3);margin-top:2px}
.workspace{flex:1;display:flex;flex-direction:column;min-width:0}
.topbar{height:64px;flex:none;display:flex;align-items:center;gap:20px;padding:0 24px;border-bottom:1px solid var(--line);background:var(--bg)}
.crumb{font-size:12.5px;color:var(--ink2)}
.search{width:340px;height:34px;border:1px solid var(--line);border-radius:8px;background:var(--card);display:flex;align-items:center;gap:8px;padding:0 10px;color:var(--ink3);font-size:12px}
.search-icon{display:flex}
.search-text{flex:1}
.kbd{font-size:10px;border:1px solid var(--line);border-radius:5px;padding:2px 5px;color:var(--ink3);background:var(--bg)}
.top-actions{margin-left:auto;display:flex;align-items:center;gap:10px}
.icon-btn{position:relative;width:34px;height:34px;border:1px solid var(--line);border-radius:8px;background:var(--card);display:flex;align-items:center;justify-content:center;color:var(--ink2)}
.notice-dot{position:absolute;top:7px;right:7px;width:5px;height:5px;border-radius:50%;background:var(--accent)}
.primary-btn{height:34px;border:none;border-radius:8px;background:var(--accent);color:#fff;display:flex;align-items:center;gap:6px;padding:0 14px;font-size:12.5px;font-weight:600;font-family:inherit;box-shadow:0 1px 2px rgba(198,97,63,.2)}
.ghost-btn{height:32px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink2);padding:0 12px;font-size:12px;font-family:inherit}
.content-row{flex:1;display:flex;min-height:0}
.main{flex:1;min-width:0;padding:24px 28px;overflow:hidden}
.page-head{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px}
.page-head h1{font-size:28px;font-weight:700;margin:0;letter-spacing:-.3px}
.page-sub{font-size:12.5px;color:var(--ink3);margin:6px 0 0}
.head-right{display:flex;align-items:center;gap:8px}
.progress-card{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:8px 12px}
.progress-copy{display:flex;flex-direction:column;font-size:11px;color:var(--ink3)}
.progress-copy b{font-size:16px;color:var(--ink);font-variant-numeric:tabular-nums}
.ring{position:relative;display:inline-flex;align-items:center;justify-content:center;flex:none}
.ring svg{position:absolute;inset:0}
.ring-label{position:relative;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums}
.view-tabs{display:flex;align-items:center;gap:18px;font-size:12.5px;color:var(--ink3);border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:14px}
.view-tabs .active{color:var(--ink);font-weight:600;border-bottom:2px solid var(--accent);padding-bottom:9px;margin-bottom:-11px}
.view-spacer{flex:1}
.filter-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);border-radius:7px;padding:5px 9px;background:var(--card);font-size:11.5px;color:var(--ink2)}
.group-label{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--ink2);margin:14px 2px 8px}
.group-count{font-size:10.5px;color:var(--ink3);font-weight:400}
.list-card{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.task-row{display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--line)}
.task-row:last-child{border-bottom:none}
.status-radio{width:16px;height:16px;border-radius:50%;border:1.5px solid var(--line-strong);flex:none;display:inline-block}
.status-radio.doing{border-color:var(--accent);border-width:4px}
.status-radio.waiting{border-color:var(--amber);border-width:4px}
.status-radio.blocked{border-color:var(--red);border-width:4px}
.status-radio.done{background:var(--green);border-color:var(--green)}
.task-main{flex:1;min-width:0}
.task-title{font-size:13px;font-weight:500}
.task-sub{font-size:10.5px;color:var(--ink3);margin-top:3px}
.task-meta{display:flex;gap:6px;flex:none;max-width:230px;overflow:hidden}
.task-est{font-size:10.5px;color:var(--ink3);width:64px;text-align:right;flex:none}
.prio-flag{font-size:10px;color:var(--red)}
.row-arrow{color:var(--ink3);opacity:.5;display:flex}
.chip{display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:3px 7px;border-radius:5px;white-space:nowrap;line-height:1.2}
.dot{display:inline-block;border-radius:50%}
.drawer{width:380px;flex:none;background:var(--card);border-left:1px solid var(--line);padding:0 20px 18px;display:flex;flex-direction:column;overflow:hidden}
.drawer-tabs{height:48px;display:flex;align-items:center;gap:18px;border-bottom:1px solid var(--line);font-size:12px;color:var(--ink3)}
.drawer-tabs .active{color:var(--ink);font-weight:600;border-bottom:2px solid var(--accent);height:48px;display:flex;align-items:center}
.drawer-tabs b{font-size:10px;background:var(--sunken);padding:1px 5px;border-radius:9px;margin-left:3px}
.drawer-actions{margin-left:auto;display:flex;color:var(--ink3)}
.drawer-head{display:flex;align-items:flex-start;gap:10px;padding:18px 0 14px}
.drawer-head h2{font-size:16px;line-height:1.4;margin:0;flex:1;font-weight:650}
.drawer-tools{color:var(--ink3)}
.field-list{border-top:1px solid var(--line);padding-top:8px}
.field{display:flex;align-items:center;gap:10px;padding:6px 0;font-size:11.5px}
.f-label{width:88px;color:var(--ink3);display:flex;align-items:center;gap:6px;flex:none}
.f-value{color:var(--ink2)}
.space-work{color:var(--accent-deep);display:flex;align-items:center;gap:5px}
.run-pill{background:var(--green);color:#fff;font-size:10px;padding:3px 8px;border-radius:5px}
.priority-high{color:var(--red);font-weight:600}
.section-label{font-size:10.5px;color:var(--ink3);margin:16px 0 7px;font-weight:600}
.note-box{border:1px solid var(--line);border-radius:8px;padding:9px 10px;font-size:11px;color:var(--ink2);line-height:1.6;background:var(--bg)}
.attach-row{display:flex;align-items:center;gap:8px;margin-top:10px}
.attach-btn{display:flex;align-items:center;gap:5px;border:1px solid var(--line);border-radius:7px;padding:5px 9px;font-size:10.5px;color:var(--ink2)}
.attach-count{margin-left:auto;font-size:10px;color:var(--ink3)}
.focus-card{margin-top:auto;border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--bg)}
.focus-head{display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:600;color:var(--ink2)}
.focus-options{display:flex;gap:6px;align-items:center;margin-top:10px;font-size:10.5px;color:var(--ink3)}
.focus-options span{border:1px solid var(--line);border-radius:5px;padding:3px 7px}
.focus-options .on{background:var(--accent);border-color:var(--accent);color:#fff}
.focus-min{margin-left:auto;border:none!important;color:var(--ink2)}
.focus-bottom{display:flex;align-items:center;gap:12px;margin-top:10px;font-size:10.5px;color:var(--ink3)}
.kanban{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;height:calc(100% - 120px);align-items:start}
.kb-col{background:#F3F0E8;border:1px solid var(--line);border-radius:12px;padding:12px;min-height:320px}
.kb-head{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--ink2);margin-bottom:10px}
.kb-count{font-size:10px;color:var(--ink3);background:var(--card);border-radius:9px;padding:1px 6px}
.kb-plus{margin-left:auto;color:var(--ink3);font-size:15px}
.kb-card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:11px 12px;margin-bottom:10px;box-shadow:0 1px 2px rgba(25,25,25,.03)}
.kb-card.selected{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent),0 4px 12px rgba(198,97,63,.08)}
.kb-top{display:flex;justify-content:space-between;align-items:center}
.kb-flags{font-size:10px;color:var(--red);letter-spacing:2px}
.kb-title{font-size:12.5px;font-weight:600;margin-top:8px;line-height:1.45}
.kb-sub{font-size:10.5px;color:var(--ink3);line-height:1.5;margin-top:5px}
.kb-meta{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:var(--ink3);margin-top:9px}
.kb-meta span{display:flex;align-items:center;gap:4px}
.kb-progress{background:var(--sunken);border-radius:4px;padding:2px 5px}
.segmented{display:flex;align-items:center;gap:2px;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:3px;font-size:11.5px;color:var(--ink3)}
.segmented span{padding:4px 9px;border-radius:6px}
.segmented .on{background:var(--ink);color:#fff}
.seg-nav{padding:4px 6px!important}
.seg-date{color:var(--ink2);padding:4px 10px!important}
.cal-wrap{display:flex;gap:18px;height:calc(100% - 100px)}
.cal-card{flex:1;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.cal-week{display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid var(--line);padding:11px 0;font-size:10.5px;color:var(--ink3);text-align:center}
.cal-grid{flex:1;display:grid;grid-template-columns:repeat(7,1fr);grid-template-rows:repeat(5,1fr)}
.cal-cell{border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:8px;position:relative;min-height:86px}
.cal-cell:nth-child(7n){border-right:none}
.cal-cell.empty{background:#FCFBF8}
.cal-cell.today{background:var(--accent-soft)}
.cal-num{font-size:11px;color:var(--ink2);font-variant-numeric:tabular-nums}
.cal-cell.today .cal-num{background:var(--accent);color:#fff;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:600}
.cal-ev{display:block;font-size:9px;padding:2px 5px;border-radius:4px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.agenda{width:316px;flex:none;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;display:flex;flex-direction:column;overflow:hidden}
.agenda-head{display:flex;justify-content:space-between;align-items:flex-start}
.agenda-eyebrow{font-size:10.5px;color:var(--ink3)}
.agenda-head h3{font-size:22px;margin:2px 0 0;letter-spacing:-.2px}
.agenda-count{font-size:10px;color:var(--ink3);border:1px solid var(--line);border-radius:5px;padding:3px 6px}
.agenda-search{display:flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:7px;padding:6px 8px;font-size:10.5px;color:var(--ink3);margin:12px 0 6px}
.agenda-list{overflow:hidden}
.agenda-item{display:flex;gap:9px;padding:10px 0;border-bottom:1px solid var(--line);align-items:flex-start}
.agenda-item:last-child{border-bottom:none}
.agenda-time{width:76px;font-size:9.5px;color:var(--ink3);font-variant-numeric:tabular-nums;padding-top:2px;flex:none}
.agenda-dot{width:6px;height:6px;border-radius:50%;margin-top:5px;flex:none}
.agenda-main{flex:1}
.agenda-title{font-size:11px;font-weight:500;line-height:1.4}
.agenda-sub{font-size:9.5px;color:var(--ink3);margin-top:3px}
.dash-grid{display:grid;grid-template-columns:1.25fr .9fr .85fr;grid-template-rows:auto auto 1fr;gap:14px;height:calc(100% - 90px)}
.dash-hero{grid-column:1 / span 2;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px 22px;display:flex;align-items:center;gap:26px;min-height:180px}
.hero-eyebrow{font-size:11px;color:var(--ink3)}
.hero-num{font-size:52px;font-weight:700;letter-spacing:-2px;line-height:1.1;margin-top:2px}
.hero-num span{font-size:24px;color:var(--ink3);font-weight:500;margin-left:2px}
.hero-sub{font-size:11px;color:var(--ink3);margin-top:4px}
.hero-ring{margin-left:auto}
.hero-side{display:flex;flex-direction:column;gap:12px;min-width:180px}
.mini-stat{display:flex;align-items:baseline;gap:8px;font-size:11px;color:var(--ink3);border-top:1px solid var(--line);padding-top:9px}
.mini-stat:first-child{border-top:none;padding-top:0}
.mini-label{width:56px}
.mini-stat b{font-size:16px;color:var(--ink);font-variant-numeric:tabular-nums}
.mini-delta{font-size:9.5px;color:var(--ink3);margin-left:auto}
.mini-delta.up{color:var(--green)}
.mini-delta.down{color:var(--red)}
.dash-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;overflow:hidden}
.card-head{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:600}
.card-sub{font-size:10px;color:var(--ink3);font-weight:400}
.card-more{color:var(--ink3)}
.bar-chart{display:flex;align-items:flex-end;gap:7px;height:150px;margin-top:14px;padding-top:6px}
.bar-col{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px;height:100%}
.bar{width:100%;border-radius:4px 4px 2px 2px;background:#E9E4D8}
.bar.current{background:var(--accent)}
.bar-col span{font-size:8px;color:var(--ink3);white-space:nowrap}
.chart-foot{display:flex;align-items:center;gap:6px;font-size:9.5px;color:var(--ink3);margin-top:6px}
.legend-dot{width:7px;height:7px;border-radius:50%;background:var(--accent)}
.insight-card{background:linear-gradient(160deg,#FDF3ED 0%,#F7E8DE 55%,#F2E0D2 100%);border-color:#EAD4C4;display:flex;flex-direction:column}
.insight-badge{align-self:flex-start;background:rgba(255,255,255,.65);border:1px solid #E8CDBB;border-radius:9px;padding:3px 8px;font-size:9.5px;color:#9B5A41}
.insight-num{font-size:42px;font-weight:700;letter-spacing:-1.5px;color:#7A3F2B;margin-top:12px}
.insight-num span{font-size:18px;font-weight:500}
.insight-title{font-size:13px;font-weight:650;color:#4A2C20;margin-top:2px}
.insight-card p{font-size:10.5px;line-height:1.6;color:#7A5A4C;margin:8px 0 12px}
.insight-btn{margin-top:auto;align-self:flex-start;border:1px solid #DDBBA7;background:rgba(255,255,255,.7);border-radius:7px;padding:6px 10px;font-size:10.5px;color:#7A3F2B;font-family:inherit}
.waterfall-card{grid-column:1 / span 2}
.wf-row{display:flex;align-items:center;gap:10px;margin-top:12px;font-size:10.5px;color:var(--ink2)}
.wf-label{width:58px;color:var(--ink3)}
.wf-track{flex:1;height:10px;background:var(--sunken);border-radius:5px;overflow:hidden}
.wf-track i{display:block;height:100%;border-radius:5px}
.wf-val{width:24px;text-align:right;font-variant-numeric:tabular-nums}
.wf-note{font-size:9.5px;color:var(--ink3);margin-top:10px}
.attention-card{grid-column:3;grid-row:2 / span 2}
.attention-list{margin-top:8px}
.attention-item{display:flex;align-items:center;gap:9px;padding:10px 0;border-bottom:1px solid var(--line)}
.attention-item:last-child{border-bottom:none}
.att-ico{width:7px;height:7px;border-radius:50%;flex:none}
.att-ico.danger{background:var(--red)}.att-ico.warn{background:var(--amber)}.att-ico.info{background:var(--blue)}
.att-title{font-size:10.5px;font-weight:600}
.att-sub{font-size:9.5px;color:var(--ink3);margin-top:2px}
.attention-item svg{margin-left:auto;opacity:.5}
.focus-week{grid-column:3;grid-row:3}
.donut-wrap{display:flex;align-items:center;gap:16px;margin-top:12px}
.donut{width:86px;height:86px;border-radius:50%;background:conic-gradient(#D97757 0 62%,#6A9BCC 62% 88%,#788C5D 88% 100%);position:relative;flex:none}
.donut:after{content:"";position:absolute;inset:18px;background:var(--card);border-radius:50%}
.donut-legend{font-size:10px;color:var(--ink2);display:flex;flex-direction:column;gap:6px}
.donut-legend div{display:flex;align-items:center;gap:6px}
.donut-legend span{width:7px;height:7px;border-radius:2px}
.donut-legend b{margin-left:auto;color:var(--ink);font-weight:600}
.project-head{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:14px}
.project-title-row{display:flex;align-items:center;gap:12px}
.project-icon{width:38px;height:38px;border-radius:10px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center}
.project-title-row h2{font-size:19px;margin:0;letter-spacing:-.2px}
.project-title-row p{font-size:11px;color:var(--ink3);margin:3px 0 0}
.project-status{margin-left:auto;font-size:10px;color:var(--accent-deep);background:var(--accent-soft);border-radius:6px;padding:4px 8px}
.project-meta{display:flex;align-items:center;gap:14px;margin-top:12px;font-size:10.5px;color:var(--ink3)}
.project-meta .ghost-btn{margin-left:auto}
.stat-strip{display:grid;grid-template-columns:repeat(4,1fr) 1.6fr;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-bottom:14px}
.stat{padding:12px 16px;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:4px}
.stat:last-child{border-right:none;flex-direction:row;align-items:center;gap:10px}
.stat span{font-size:9.5px;color:var(--ink3)}
.stat b{font-size:22px;font-variant-numeric:tabular-nums;font-weight:650}
.stat b.green{color:var(--green)}.stat b.amber{color:var(--amber)}.stat b.red{color:var(--red)}
.stat.wide{display:flex}
.progress{flex:1;height:8px;background:var(--sunken);border-radius:4px;overflow:hidden}
.progress i{display:block;height:100%;background:var(--accent);border-radius:4px}
.stat b.pct{font-size:12px;color:var(--ink2);width:36px;text-align:right}
.project-tools{display:flex;align-items:center;gap:14px;font-size:11px;color:var(--ink3);margin-bottom:10px}
.tool-link{padding:4px 0}
.tool-spacer{flex:1}
.doc-layout{display:flex;height:calc(100% + 48px);margin:-24px -28px}
.doc-tree{width:228px;flex:none;border-right:1px solid var(--line);background:var(--sunken);padding:18px 12px;overflow:hidden}
.tree-head{display:flex;justify-content:space-between;font-size:12px;font-weight:600;padding:0 8px 10px}
.tree-plus{color:var(--ink3);font-size:15px}
.tree-search{display:flex;align-items:center;gap:6px;background:var(--card);border:1px solid var(--line);border-radius:7px;padding:6px 8px;font-size:10px;color:var(--ink3);margin:0 4px 12px}
.tree-group{font-size:10px;color:var(--ink3);padding:10px 8px 5px;font-weight:600}
.tree-item{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--ink2);padding:7px 8px;border-radius:7px}
.tree-item.active{background:var(--card);border:1px solid var(--line);color:var(--ink);font-weight:600}
.editor{flex:1;background:var(--card);padding:22px 56px;overflow:hidden;position:relative}
.editor-top{display:flex;align-items:center;gap:10px;font-size:10px;color:var(--ink3)}
.editor-icon{display:flex}
.editor-meta{display:flex;gap:7px;align-items:center}
.saved{color:var(--green);margin-left:8px}
.editor-top .ghost-btn{margin-left:auto}
.doc-title{font-size:30px;letter-spacing:-.5px;margin:16px 0 8px;font-weight:700}
.doc-tags{display:flex;gap:6px;margin-bottom:18px}
.doc-body{max-width:640px;font-size:12px;line-height:1.85;color:var(--ink2)}
.doc-body p{margin:0 0 12px}
.doc-body h2{font-size:15px;color:var(--ink);margin:20px 0 8px;font-weight:650}
.check-line{display:flex;align-items:center;gap:8px;padding:3px 0;font-size:11.5px;color:var(--ink2)}
.check-line.done span:last-child{color:var(--ink3);text-decoration:line-through}
.check-box{width:14px;height:14px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;background:var(--accent);flex:none}
.check-box.empty{background:var(--card);border:1.5px solid var(--line-strong)}
.doc-table{width:100%;border-collapse:collapse;font-size:10.5px;margin:8px 0 12px}
.doc-table th{text-align:left;font-weight:600;color:var(--ink3);border-bottom:1px solid var(--line);padding:6px 8px;background:#FBFAF7}
.doc-table td{border-bottom:1px solid var(--line);padding:6px 8px}
.doc-callout{background:var(--accent-soft);border-left:3px solid var(--accent);border-radius:6px;padding:9px 12px;font-size:10.5px;color:#6B4436;margin:12px 0}
.task-ref{display:inline-flex;align-items:center;gap:4px;color:var(--accent-deep);border:1px solid #E8CDBB;border-radius:5px;padding:2px 6px;font-size:10px}
.ai-bar{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;background:var(--ink);color:#fff;border-radius:9px;padding:7px 12px;font-size:10px;box-shadow:var(--shadow)}
.doc-outline{width:190px;flex:none;border-left:1px solid var(--line);padding:20px 16px;font-size:10.5px}
.outline-title{font-size:10px;color:var(--ink3);font-weight:600;margin-bottom:10px}
.outline-item{padding:5px 0;color:var(--ink3)}
.outline-item.active{color:var(--accent-deep);font-weight:600}
.outline-meta{font-size:9px;color:var(--ink3);margin-top:18px;border-top:1px solid var(--line);padding-top:10px}
.focus-page{background:var(--bg)}
.focus-body{width:1440px;height:900px;overflow:hidden;background:var(--bg)}
.focus-screen{width:1440px;height:900px;background:radial-gradient(75% 55% at 50% 42%,#FBF7EF 0%,#FAF9F5 70%);padding:26px 40px;position:relative;overflow:hidden}
.focus-nav{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--ink3)}
.focus-brand{display:flex;align-items:center;gap:8px;font-weight:600;color:var(--ink2)}
.focus-center{display:flex;flex-direction:column;align-items:center;margin-top:52px}
.focus-task{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ink2);margin-bottom:24px}
.focus-caption{font-size:11px;color:var(--ink3);margin-top:18px}
.focus-controls{display:flex;gap:10px;margin-top:20px}
.focus-controls .primary-btn{height:38px;padding:0 20px}
.focus-controls .ghost-btn{height:38px;padding:0 20px}
.focus-durations{display:flex;gap:6px;margin-top:22px;font-size:10.5px;color:var(--ink3)}
.focus-durations span{border:1px solid var(--line);border-radius:6px;padding:4px 10px;background:var(--card)}
.focus-durations .on{background:var(--accent);border-color:var(--accent);color:#fff}
.focus-history{position:absolute;right:40px;bottom:40px;width:300px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.fh-head{font-size:11px;font-weight:600;display:flex;justify-content:space-between;align-items:center}
.fh-head span{font-size:9.5px;color:var(--ink3);font-weight:400}
.fh-item{display:flex;align-items:center;gap:8px;font-size:10.5px;color:var(--ink2);padding:8px 0;border-bottom:1px solid var(--line)}
.fh-item:last-child{border-bottom:none}
.fh-dot{width:6px;height:6px;border-radius:50%}
.fh-item b{margin-left:auto;font-size:9.5px;color:var(--ink3);font-weight:400}
/* mobile */
.mobile-body{width:390px;height:844px;overflow:hidden;background:var(--bg)}
.mobile{width:390px;height:844px;position:relative;overflow:hidden;background:var(--bg)}
.m-status{height:44px;display:flex;justify-content:space-between;align-items:center;padding:0 22px;font-size:11px;font-weight:600;color:var(--ink)}
.m-head{display:flex;justify-content:space-between;align-items:flex-start;padding:8px 20px 14px}
.m-hello{font-size:10.5px;color:var(--ink3)}
.m-head h1{font-size:26px;margin:2px 0 0;letter-spacing:-.3px}
.m-search{display:flex;align-items:center;gap:7px;margin:0 20px 12px;background:var(--card);border:1px solid var(--line);border-radius:9px;padding:8px 10px;font-size:11px;color:var(--ink3)}
.m-tabs{display:flex;gap:16px;padding:0 20px 10px;font-size:11px;color:var(--ink3);border-bottom:1px solid var(--line)}
.m-tabs .on{color:var(--ink);font-weight:600;border-bottom:2px solid var(--accent);padding-bottom:8px;margin-bottom:-11px}
.m-group{display:flex;align-items:center;gap:7px;font-size:10.5px;font-weight:600;color:var(--ink2);padding:13px 20px 6px}
.m-group span{font-size:9px;color:var(--ink3);font-weight:400}
.m-list{margin:0 14px;background:var(--card);border:1px solid var(--line);border-radius:11px;overflow:hidden}
.m-task{display:flex;align-items:center;gap:10px;padding:11px 12px;border-bottom:1px solid var(--line)}
.m-task:last-child{border-bottom:none}
.m-task.active{background:#FDF7F3}
.m-task div{flex:1;min-width:0}
.m-task b{display:block;font-size:11.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m-task small{display:block;font-size:9.5px;color:var(--ink3);margin-top:3px}
.m-chev{color:var(--ink3);opacity:.5;display:flex}
.m-fab{position:absolute;right:18px;bottom:92px;width:46px;height:46px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:300;box-shadow:0 6px 16px rgba(198,97,63,.35)}
.m-tabbar{position:absolute;left:0;right:0;bottom:0;height:68px;background:rgba(250,249,245,.96);border-top:1px solid var(--line);display:flex;justify-content:space-around;padding-top:8px}
.m-tabbar div{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:9px;color:var(--ink3)}
.m-tabbar div.on{color:var(--accent-deep)}
.m-hero{margin:0 14px 12px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;display:flex;align-items:center;justify-content:space-between}
.m-hero-copy span{font-size:10px;color:var(--ink3)}
.m-hero-copy b{display:block;font-size:36px;letter-spacing:-1.2px;margin:2px 0}
.m-hero-copy small{font-size:9.5px;color:var(--ink3)}
.m-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 14px 12px}
.m-kpis div{background:var(--card);border:1px solid var(--line);border-radius:9px;padding:9px 10px}
.m-kpis span{display:block;font-size:9px;color:var(--ink3)}
.m-kpis b{display:block;font-size:15px;margin-top:3px}
.m-kpis b.red{color:var(--red)}
.m-kpis small{font-size:8.5px;color:var(--ink3)}
.m-kpis small.up{color:var(--green)}
.m-kpis small.down{color:var(--red)}
.m-card{margin:0 14px 12px;background:var(--card);border:1px solid var(--line);border-radius:11px;padding:12px 14px}
.m-card-head{display:flex;justify-content:space-between;font-size:10.5px;font-weight:600}
.m-card-head span{font-size:9px;color:var(--ink3);font-weight:400}
.m-bars{display:flex;align-items:flex-end;gap:5px;height:70px;margin-top:10px}
.m-bars i{flex:1;background:#E9E4D8;border-radius:3px 3px 1px 1px}
.m-bars i.on{background:var(--accent)}
.m-insight{margin:0 14px 12px;background:linear-gradient(160deg,#FDF3ED,#F5E5D9);border:1px solid #EAD4C4;border-radius:11px;padding:12px 14px}
.m-insight span{font-size:9px;color:#9B5A41;background:rgba(255,255,255,.6);border:1px solid #E8CDBB;border-radius:7px;padding:2px 6px}
.m-insight b{display:block;font-size:24px;color:#7A3F2B;margin-top:8px}
.m-insight p{font-size:9.5px;line-height:1.55;color:#7A5A4C;margin:6px 0 0}
.m-att{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)}
.m-att:last-child{border-bottom:none}
.m-att b{display:block;font-size:10px;font-weight:600}
.m-att small{display:block;font-size:8.5px;color:var(--ink3);margin-top:2px}
'''

with open(os.path.join(OUT, "styles.css"), "w", encoding="utf-8") as f:
    f.write(CSS)

pages = {
    "01_today.html": today(),
    "02_kanban.html": kanban(),
    "03_calendar.html": calendar(),
    "04_dashboard.html": dashboard(),
    "05_project.html": project(),
    "06_document.html": document(),
    "07_focus.html": focus(),
    "08_mobile_today.html": mobile_today(),
    "09_mobile_dashboard.html": mobile_dashboard(),
}
for name, html in pages.items():
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(html)
print("wrote", len(pages), "mockups")
