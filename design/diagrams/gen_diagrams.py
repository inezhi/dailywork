#!/usr/bin/env python3
"""Generate the Dailywork architecture & flow diagrams as whiteboard-ready SVGs."""
import math
import os

OUT = os.path.dirname(os.path.abspath(__file__))

BG = "#FAF9F5"
CARD = "#FFFFFF"
BORDER = "#E8E6DC"
BORDER_STRONG = "#D6D2C4"
INK = "#141413"
INK2 = "#5B5750"
INK3 = "#8A857D"
ACCENT = "#D97757"
ACCENT_SOFT = "#F4E5DD"
ACCENT_DEEP = "#C6613F"
SUCCESS = "#788C5D"
SUCCESS_SOFT = "#EEF1E7"
WARN = "#A8761C"
WARN_SOFT = "#F7EFDF"
DANGER = "#B5473C"
DANGER_SOFT = "#F7E6E3"
INFO = "#6A9BCC"
INFO_SOFT = "#EAF1F7"
ARROW = "#B3ADA0"
FONT = "'Noto Sans SC','PingFang SC','Inter',sans-serif"


def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def tw(s, size):
    return sum(1.0 if ord(c) > 127 else 0.6 for c in str(s)) * size


class SVG:
    def __init__(self, w, h, title, subtitle, tag=None):
        self.w, self.h = w, h
        self.title, self.subtitle = title, subtitle
        self.tag = tag
        self.parts = []

    def add(self, s):
        self.parts.append(s)

    def text(self, x, y, s, size=14, fill=INK, weight=400, anchor="start", opacity=1, italic=False):
        style = ' font-style="italic"' if italic else ""
        self.add(
            f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" '
            f'fill="{fill}" text-anchor="{anchor}" opacity="{opacity}"{style}>{esc(s)}</text>'
        )

    def rect(self, x, y, w, h, fill=CARD, stroke=BORDER, rx=12, sw=1, shadow=False, dash=None, opacity=1):
        extra = f' filter="url(#soft)"' if shadow else ""
        if dash:
            extra += f' stroke-dasharray="{dash}"'
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" '
                 f'stroke="{stroke}" stroke-width="{sw}" opacity="{opacity}"{extra}/>')

    def circle(self, cx, cy, r, fill=CARD, stroke=BORDER, sw=1, opacity=1, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" opacity="{opacity}"{d}/>')

    def line(self, x1, y1, x2, y2, color=ARROW, sw=1.6, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{sw}"{d}/>')

    def polyline(self, pts, color=ARROW, sw=1.6, dash=None, fill="none"):
        p = " ".join(f"{x},{y}" for x, y in pts)
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<polyline points="{p}" fill="{fill}" stroke="{color}" stroke-width="{sw}" '
                 f'stroke-linejoin="round" stroke-linecap="round"{d}/>')

    def arrow(self, pts, color=ARROW, sw=1.6, label=None, lp=None, label_size=12,
              label_color=INK2, dash=None, label_bg=BG):
        self.polyline(pts, color=color, sw=sw, dash=dash)
        (x1, y1), (x2, y2) = pts[-2], pts[-1]
        ang = math.atan2(y2 - y1, x2 - x1)
        size, half = 9, 4.2
        tip = (x2, y2)
        b1 = (x2 - size * math.cos(ang) + half * math.sin(ang), y2 - size * math.sin(ang) - half * math.cos(ang))
        b2 = (x2 - size * math.cos(ang) - half * math.sin(ang), y2 - size * math.sin(ang) + half * math.cos(ang))
        self.add(f'<polygon points="{tip[0]},{tip[1]} {b1[0]},{b1[1]} {b2[0]},{b2[1]}" fill="{color}"/>')
        if label and lp:
            w = tw(label, label_size) + 14
            self.add(f'<rect x="{lp[0]-w/2}" y="{lp[1]-label_size-3}" width="{w}" height="{label_size+9}" '
                     f'rx="5" fill="{label_bg}" opacity="0.96"/>')
            self.text(lp[0], lp[1], label, size=label_size, fill=label_color, anchor="middle")

    def pill(self, x, y, text, color=INK2, bg="#F6F3EC", size=12, pad=10, h=24):
        w = tw(text, size) + pad * 2
        self.rect(x, y, w, h, fill=bg, stroke="none", rx=h / 2, sw=0)
        self.text(x + w / 2, y + h / 2 + size * 0.36, text, size=size, fill=color, anchor="middle")
        return w

    def icon(self, kind, x, y, color=ACCENT, scale=1.0):
        s = scale
        if kind == "inbox":
            self.add(f'<path d="M{x} {y+3*s} L{x+26*s} {y+3*s} L{x+26*s} {y+24*s} L{x} {y+24*s} Z" '
                     f'fill="none" stroke="{color}" stroke-width="1.6" stroke-linejoin="round"/>')
            self.add(f'<path d="M{x} {y+14*s} L{x+8*s} {y+14*s} L{x+11*s} {y+19*s} L{x+15*s} {y+19*s} '
                     f'L{x+18*s} {y+14*s} L{x+26*s} {y+14*s}" fill="none" stroke="{color}" stroke-width="1.6" stroke-linejoin="round"/>')
        elif kind == "window":
            self.rect(x, y, 26 * s, 20 * s, fill="none", stroke=color, rx=3 * s, sw=1.6)
            self.line(x + 1, y + 7 * s, x + 25 * s, y + 7 * s, color=color, sw=1.4)
            self.line(x + 5 * s, y + 3.5 * s, x + 5 * s, y + 3.5 * s, color=color, sw=2.4)
            self.line(x + 9 * s, y + 3.5 * s, x + 9 * s, y + 3.5 * s, color=color, sw=2.4)
        elif kind == "server":
            for i in range(3):
                self.rect(x, y + i * 7 * s, 24 * s, 5 * s, fill="none", stroke=color, rx=1.5 * s, sw=1.4)
                self.circle(x + 4 * s, y + i * 7 * s + 2.5 * s, 1.1 * s, fill=color, stroke="none")
        elif kind == "db":
            self.add(f'<ellipse cx="{x+13*s}" cy="{y+5*s}" rx="{13*s}" ry="{5*s}" fill="none" stroke="{color}" stroke-width="1.6"/>')
            self.line(x, y + 5 * s, x, y + 20 * s, color=color, sw=1.6)
            self.line(x + 26 * s, y + 5 * s, x + 26 * s, y + 20 * s, color=color, sw=1.6)
            self.add(f'<path d="M{x} {y+20*s} Q{x+13*s} {y+26*s} {x+26*s} {y+20*s}" fill="none" stroke="{color}" stroke-width="1.6"/>')
            self.add(f'<path d="M{x} {y+12*s} Q{x+13*s} {y+18*s} {x+26*s} {y+12*s}" fill="none" stroke="{color}" stroke-width="1.2" opacity="0.6"/>')
        elif kind == "cloud":
            self.add(f'<path d="M{x+6*s} {y+18*s} C{x-1*s} {y+18*s} {x-1*s} {y+8*s} {x+6*s} {y+8*s} '
                     f'C{x+7*s} {y+1*s} {x+18*s} {y+1*s} {x+20*s} {y+8*s} C{x+27*s} {y+8*s} {x+27*s} {y+18*s} {x+20*s} {y+18*s} Z" '
                     f'fill="none" stroke="{color}" stroke-width="1.6" stroke-linejoin="round"/>')
        elif kind == "phone":
            self.rect(x + 4 * s, y, 16 * s, 26 * s, fill="none", stroke=color, rx=4 * s, sw=1.6)
            self.line(x + 9 * s, y + 21 * s, x + 15 * s, y + 21 * s, color=color, sw=1.6)
        elif kind == "key":
            self.circle(x + 6 * s, y + 7 * s, 4.5 * s, fill="none", stroke=color, sw=1.6)
            self.line(x + 10 * s, y + 10 * s, x + 22 * s, y + 22 * s, color=color, sw=1.8)
            self.line(x + 17 * s, y + 17 * s, x + 21 * s, y + 13 * s, color=color, sw=1.8)
        elif kind == "calendar":
            self.rect(x, y + 3 * s, 24 * s, 21 * s, fill="none", stroke=color, rx=3 * s, sw=1.5)
            self.line(x, y + 9 * s, x + 24 * s, y + 9 * s, color=color, sw=1.4)
            self.line(x + 7 * s, y, x + 7 * s, y + 5 * s, color=color, sw=1.6)
            self.line(x + 17 * s, y, x + 17 * s, y + 5 * s, color=color, sw=1.6)
        elif kind == "timer":
            self.circle(x + 13 * s, y + 14 * s, 10 * s, fill="none", stroke=color, sw=1.6)
            self.line(x + 13 * s, y + 14 * s, x + 13 * s, y + 8 * s, color=color, sw=1.7)
            self.line(x + 13 * s, y + 14 * s, x + 18 * s, y + 16 * s, color=color, sw=1.5)
            self.line(x + 10 * s, y + 1 * s, x + 16 * s, y + 1 * s, color=color, sw=1.6)
        elif kind == "chart":
            self.line(x, y + 24 * s, x + 24 * s, y + 24 * s, color=color, sw=1.4)
            self.line(x + 2 * s, y + 24 * s, x + 2 * s, y + 10 * s, color=color, sw=1.4)
            self.line(x + 10 * s, y + 24 * s, x + 10 * s, y + 4 * s, color=color, sw=1.4)
            self.line(x + 18 * s, y + 24 * s, x + 18 * s, y + 15 * s, color=color, sw=1.4)
        elif kind == "spark":
            self.add(f'<path d="M{x+13*s} {y} L{x+16*s} {y+9*s} L{x+25*s} {y+12*s} L{x+16*s} {y+15*s} '
                     f'L{x+13*s} {y+24*s} L{x+10*s} {y+15*s} L{x+1*s} {y+12*s} L{x+10*s} {y+9*s} Z" '
                     f'fill="none" stroke="{color}" stroke-width="1.5" stroke-linejoin="round"/>')
        elif kind == "shield":
            self.add(f'<path d="M{x+13*s} {y} L{x+25*s} {y+5*s} L{x+23*s} {y+18*s} Q{x+13*s} {y+27*s} {x+3*s} {y+18*s} '
                     f'L{x+1*s} {y+5*s} Z" fill="none" stroke="{color}" stroke-width="1.6" stroke-linejoin="round"/>')
        elif kind == "ops":
            self.circle(x + 13 * s, y + 13 * s, 6 * s, fill="none", stroke=color, sw=1.6)
            for dx, dy in [(13, 0), (13, 26), (0, 13), (26, 13)]:
                self.line(x + dx * s, y + dy * s, x + (13 + (dx - 13) * 0.55) * s, y + (13 + (dy - 13) * 0.55) * s, color=color, sw=1.6)
        elif kind == "doc":
            self.add(f'<path d="M{x+3*s} {y+1*s} L{x+17*s} {y+1*s} L{x+23*s} {y+7*s} L{x+23*s} {y+25*s} L{x+3*s} {y+25*s} Z" fill="none" stroke="{color}" stroke-width="1.5" stroke-linejoin="round"/>')
            self.line(x + 7 * s, y + 10 * s, x + 19 * s, y + 10 * s, color=color, sw=1.2)
            self.line(x + 7 * s, y + 15 * s, x + 19 * s, y + 15 * s, color=color, sw=1.2)
            self.line(x + 7 * s, y + 20 * s, x + 15 * s, y + 20 * s, color=color, sw=1.2)

    def title_block(self, tag=None):
        self.text(48, 58, self.title, size=27, fill=INK, weight=700)
        self.text(48, 84, self.subtitle, size=14, fill=INK2)
        if tag:
            w = tw(tag, 12) + 22
            self.pill(self.w - 48 - w, 42, tag, color="#FFFFFF", bg=ACCENT, size=12)

    def footer(self, note="时序 · Dailywork ｜ v1.0 ｜ 2026-10-27"):
        self.line(48, self.h - 42, self.w - 48, self.h - 42, color=BORDER, sw=1)
        self.text(48, self.h - 20, note, size=11, fill=INK3)
        self.text(self.w - 48, self.h - 20, "飞书画板 · 可编辑", size=11, fill=INK3, anchor="end")

    def render(self):
        defs = f'''<defs>
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
  <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#191919" flood-opacity="0.06"/>
</filter>
</defs>'''
        body = "\n".join(self.parts)
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
               f'viewBox="0 0 {self.w} {self.h}">\n<rect width="{self.w}" height="{self.h}" fill="{BG}"/>\n'
               f'{defs}\n{body}\n</svg>\n')
        return svg


def save(svg, name):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(svg.render())
    print("wrote", path)


# ---------------------------------------------------------------- D1 system context
def d1():
    s = SVG(1240, 720, "系统上下文", "C4 Level 1 · macOS 单机权威 + 备份/导出 + 局域网移动端", "ARCHITECTURE")
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

    # local backup
    s.rect(742, 262, 186, 150, shadow=True)
    s.icon("db", 758, 278, color=INFO, scale=1.1)
    s.text(800, 292, "备份", size=16, weight=700)
    s.text(758, 320, "Dailywork/backup", size=11.5, fill=INK2)
    s.pill(758, 334, "VACUUM INTO", INFO, INFO_SOFT, size=10)
    s.pill(758, 366, ".dailywork 导出", INFO, INFO_SOFT, size=10)

    # Phone
    s.rect(1010, 236, 178, 130, shadow=True)
    s.icon("phone", 1026, 252, color=ACCENT)
    s.text(1062, 268, "iPhone / iPad", size=14, weight=600)
    s.text(1026, 296, "Safari PWA", size=12, fill=INK2)
    s.text(1026, 318, "同一 Wi-Fi · HTTPS 局域网", size=11.5, fill=INK3)
    s.pill(1026, 332, "配对码登录", INK2, "#F6F3EC", size=11)

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
    s.arrow([(606, 320), (742, 320)], color=INFO, label="快照", lp=(674, 310))
    s.arrow([(742, 345), (606, 345)], color=INFO, label="导入恢复", lp=(674, 335))
    # phone -> Hono, below iCloud
    s.arrow([(1100, 236), (1100, 210), (620, 210), (620, 260), (606, 260)], color=INFO, label="HTTPS 局域网", lp=(860, 200), label_size=10)
    # LLM -> Hono, around the outside of the data cards
    s.arrow([(1010, 500), (1010, 560), (650, 560), (650, 300), (606, 300)], color=ACCENT, label="OpenAI API", lp=(830, 550), label_size=10)

    # note
    s.rect(84, 575, 562, 62, fill=CARD, stroke=BORDER, rx=12)
    s.text(102, 599, "关键约束", size=12, weight=600, fill=ACCENT_DEEP)
    s.text(102, 620, "默认仅监听设备；LAN 需 HTTPS + 配对码；Key 只存 Keychain；图片存 SQLite。", size=11.5, fill=INK2)

    s.footer()
    save(s, "d1_system_context.svg")

# ---------------------------------------------------------------- D2 containers
def d2():
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
        ("contexts/", ["workspace · tasking · projects · capture", "planning · focus · documents · assistant"], INK2, 100),
        ("platform/", ["SQLite · migrations · Keychain", "BackupService · logging"], INFO, 92),
        ("analytics/", "仪表盘只读投影", INFO, 72),
        ("design-system/", "tokens · 组件 · Storybook", INK2, 72),
    ]
    y = 164
    for name, desc, tint, h in pkgs:
        s.rect(476, y, 330, h, shadow=True)
        s.text(494, y + 24, name, size=14, weight=700, fill=tint if tint != INK2 else INK)
        for j, line in enumerate(desc if isinstance(desc, list) else [desc]):
            s.text(494, y + 48 + j * 18, line, size=11.5, fill=INK2)
        y += h + 12

    data = [
        ("SQLite（WAL）", "data.sqlite · 权威库", SUCCESS_SOFT, SUCCESS),
        ("op_log / outbox", "同事务写入 · 可重放", ACCENT_SOFT, ACCENT_DEEP),
        ("图片 BLOB", "blobs / attachments · sha256 去重", INFO_SOFT, INFO),
        ("快照 / 导出包", "VACUUM INTO · .dailywork", INFO_SOFT, INFO),
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

# ---------------------------------------------------------------- D3 context map
def d3():
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
    s.text(72, 600, "支撑子系统（只读 / 平台能力，不作为核心域） · analytics 订阅 outbox；backup 负责快照与导出/导入", size=12, weight=700, fill=INK3)
    supp = [("analytics", "仪表盘投影", INFO, INFO_SOFT), ("backup", "快照 · 导出/导入", INFO, INFO_SOFT),
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
    s.arrow([(272, 386), (450, 386), (450, 300), (560, 300)], color=INK3, label="projectId", lp=(500, 372), label_size=10)
    s.arrow([(272, 526), (470, 526), (470, 312), (560, 312)], color=ACCENT, label="转任务", lp=(500, 512), label_size=10)
    s.arrow([(660, 390), (660, 330)], color=INK3, label="读取任务", lp=(722, 364), label_size=10)
    s.arrow([(880, 268), (760, 268)], color=INK3, label="挂载", lp=(820, 258), label_size=10)
    s.arrow([(880, 386), (800, 386), (800, 310), (760, 310)], color=INK3, label="回写实际时长", lp=(840, 374), label_size=10)
    s.arrow([(880, 526), (820, 526), (820, 440), (760, 440)], color=INK3, label="经 ops 调用", lp=(860, 430), label_size=10)

    s.footer()
    save(s, "d3_context_map.svg")

# ---------------------------------------------------------------- D4 sync flow
def d4():
    s = SVG(1240, 700, "存储、备份与导出", "SQLite 单文件（含图片 BLOB） · 每日快照 · .dailywork 导出/导入", "STORAGE")
    s.title_block("STORAGE")

    # lanes
    s.rect(56, 122, 360, 430, fill="#F3F0E8", stroke=BORDER_STRONG, rx=18, sw=1.1, dash="7 6")
    s.text(76, 150, "写入", size=13, weight=700, fill=ACCENT_DEEP)
    s.rect(452, 122, 360, 430, fill="#EEF3F8", stroke=INFO, rx=18, sw=1.1, dash="7 6")
    s.text(472, 150, "SQLite 单文件", size=13, weight=700, fill=INFO)
    s.rect(848, 122, 336, 430, fill="#F0F2EA", stroke=SUCCESS, rx=18, sw=1.1, dash="7 6")
    s.text(868, 150, "备份与迁移", size=13, weight=700, fill=SUCCESS)

    def step(x, y, n, title, desc, tint=ACCENT):
        s.circle(x + 15, y + 15, 15, fill=tint, stroke="none")
        s.text(x + 15, y + 20, str(n), size=12, fill="#FFFFFF", weight=700, anchor="middle")
        s.text(x + 42, y + 14, title, size=13.5, weight=700, fill=INK)
        s.text(x + 42, y + 35, desc, size=10.5, fill=INK3)

    # left lane
    s.rect(80, 178, 312, 74, shadow=True)
    step(92, 190, 1, "UI / CLI 发起操作", "ops 校验 → application 用例")
    s.rect(80, 278, 312, 74, shadow=True)
    step(92, 290, 2, "同一 SQLite 事务", "业务表 + blobs + op_log + outbox")
    s.rect(80, 378, 312, 74, shadow=True)
    step(92, 390, 3, "提交并刷新", "WAL · 写入确认 · 投影异步")
    s.text(108, 480, "图片通过 attachment://<id> 引用", size=10.5, fill=INK2)
    s.text(108, 500, "不保存任何外部文件路径", size=10.5, fill=INK3)

    # middle lane cards
    s.rect(476, 176, 312, 72, shadow=True)
    s.text(494, 202, "业务表", size=13, weight=700)
    s.text(494, 226, "tasks · projects · documents · focus", size=10.5, fill=INK3)
    s.rect(476, 264, 312, 72, shadow=True)
    s.text(494, 290, "blobs / attachments", size=13, weight=700)
    s.text(494, 314, "图片 BLOB · sha256 去重 · 缩略图", size=10.5, fill=INK3)
    s.rect(476, 352, 312, 72, shadow=True)
    s.text(494, 378, "op_log / outbox", size=13, weight=700)
    s.text(494, 402, "审计 · 撤销 · 导出重放", size=10.5, fill=INK3)
    s.text(494, 466, "data.sqlite 是唯一数据源", size=11, fill=INFO)
    s.text(494, 486, "含图片，导出不会漏文件", size=10.5, fill=INK3)

    # right lane
    s.rect(872, 176, 288, 74, shadow=True)
    step(884, 188, 4, "每日快照", "VACUUM INTO → integrity_check", SUCCESS)
    s.rect(872, 264, 288, 90, shadow=True)
    step(884, 276, 5, "导出 .dailywork", "data.sqlite + manifest + markdown", SUCCESS)
    s.text(926, 330, "包含图片 BLOB · 不含 AI Key", size=10, fill=INK3)
    s.rect(872, 368, 288, 90, shadow=True)
    step(884, 380, 6, "导入恢复", "校验 → 备份当前库 → 整体替换", SUCCESS)
    s.text(926, 434, "失败自动回滚，不破坏现有数据", size=10, fill=INK3)

    # arrows
    s.arrow([(392, 215), (476, 215)], color=ACCENT, label="写入", lp=(434, 205))
    s.arrow([(392, 315), (476, 315)], color=ACCENT, label="BLOB", lp=(434, 305))
    s.arrow([(788, 215), (872, 215)], color=SUCCESS, label="快照", lp=(830, 205))
    s.arrow([(788, 315), (872, 315)], color=SUCCESS, label="导出", lp=(830, 305))
    s.arrow([(872, 408), (788, 408)], color=INFO, label="导入", lp=(830, 398))

    # bottom
    s.rect(80, 576, 1104, 56, fill=CARD, stroke=BORDER, rx=12)
    s.text(100, 600, "一致性原则", size=12, weight=700, fill=ACCENT_DEEP)
    s.text(180, 600, "图片与业务数据同库同事务；快照与导出都基于一致性副本；导入失败只回滚，不写半份数据。", size=11.5, fill=INK2)
    s.text(100, 620, "体积控制：20MB/文件 · sha256 去重 · 缩略图 · 数据库超过 2GB 时提示归档或导出。", size=11.5, fill=INK3)

    s.footer()
    save(s, "d4_storage_flow.svg")

# ---------------------------------------------------------------- D5 ops surfaces
def d5():
    s = SVG(1240, 720, "Ops 目录：一套操作，四个入口", "UI / CLI / MCP / AI 共用同一份 schema、鉴权与确认策略", "OPS")
    s.title_block("OPS")

    # defineOp card top
    s.rect(72, 122, 1096, 112, fill=CARD, stroke=ACCENT, rx=14, sw=1.4, shadow=True)
    s.text(94, 150, "defineOp({ name, version, kind, input, output, annotations, exposure, auth, scope, errors, handler })", size=12.5, weight=600, fill=ACCENT_DEEP)
    chips = [("zod 入参 / 出参", ACCENT_SOFT, ACCENT_DEEP), ("readOnly / destructive", INFO_SOFT, INFO),
             ("idempotent", SUCCESS_SOFT, SUCCESS), ("confirm 策略", WARN_SOFT, WARN),
             ("ops.list 自描述", "#F6F3EC", INK2)]
    x = 94
    for label, bg, fg in chips:
        w = s.pill(x, 168, label, fg, bg, size=11)
        x += w + 8

    # registry center
    s.rect(520, 310, 200, 140, fill=CARD, stroke=ACCENT, rx=14, sw=1.6, shadow=True)
    s.icon("ops", 536, 326, color=ACCENT)
    s.text(570, 340, "ops 注册表", size=16, weight=700)
    s.text(536, 370, "packages/ops", size=12, fill=INK2)
    s.text(536, 392, "统一校验 · 分发", size=11.5, fill=INK3)
    s.text(536, 412, "执行 application 用例", size=11.5, fill=INK3)
    s.text(536, 432, "写入 op_log（同事务）", size=11.5, fill=INK3)

    # four surfaces
    surfaces = [
        (92, 220, "HTTP RPC", "POST /api/ops/<name>", "Web UI · 局域网", ACCENT),
        (92, 430, "daily CLI", "daily task complete <id>", "脚本 · 终端 · --json", SUCCESS),
        (902, 220, "MCP Server", "daily mcp serve", "Claude Code 等 AI 客户端", INFO),
        (902, 430, "AI 工具", "OpenAI function schema", "应用内助手 · 需确认", WARN),
    ]
    for x, y, name, cmd, sub, tint in surfaces:
        s.rect(x, y, 246, 110, shadow=True)
        s.text(x + 18, y + 30, name, size=15, weight=700, fill=tint)
        s.text(x + 18, y + 54, cmd, size=11, fill=INK2)
        s.text(x + 18, y + 78, sub, size=11, fill=INK3)

    s.arrow([(338, 275), (410, 275), (410, 350), (520, 350)], color=ACCENT)
    s.arrow([(338, 485), (420, 485), (420, 420), (520, 420)], color=SUCCESS)
    s.arrow([(902, 275), (820, 275), (820, 350), (720, 350)], color=INFO)
    s.arrow([(902, 485), (820, 485), (820, 420), (720, 420)], color=WARN)
    s.arrow([(620, 310), (620, 234)], color=ACCENT)

    # common capabilities bottom
    s.rect(72, 574, 1096, 78, fill=CARD, stroke=BORDER, rx=12)
    s.text(94, 602, "共同契约", size=12.5, weight=700, fill=ACCENT_DEEP)
    items = ["统一信封 { ok, data, error, meta }", "稳定错误码 ↔ CLI 退出码", "opId 幂等", "expectedVersion 并发控制", "服务端 dryRun", "确认令牌"]
    x = 180
    for it in items:
        w = s.pill(x, 590, it, INK2, "#F6F3EC", size=10.5, h=22)
        x += w + 8
    s.text(94, 628, "能力不漂移：任何入口新增的操作，其余三个入口自动获得；AI 与 CLI 的工具描述始终同源。", size=11.5, fill=INK3)

    s.footer()
    save(s, "d5_ops_surfaces.svg")


# ---------------------------------------------------------------- D6 AI guardrails
def d6():
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
    s.arrow([(295, 584), (295, 610), (860, 610), (860, 620)], color=ACCENT, label="是", lp=(520, 598))
    s.arrow([(1065, 228), (1065, 300)], color=INFO)

    s.footer()
    save(s, "d6_ai_guardrails.svg")

# ---------------------------------------------------------------- D7 CI pipeline
def d7():
    s = SVG(1320, 540, "CI 与发布流水线", "PR 门禁 · 每晚 macOS/WebKit · 打包安装验证 · 可回滚发布", "PROCESS")
    s.title_block("PROCESS")

    stages = [
        ("提交", "Conventional\nCommits", INK2),
        ("Lint", "ESLint +\nPrettier", INFO),
        ("类型", "tsc --noEmit\nstrict", INFO),
        ("单元", "Vitest\ndomain ≥90%", SUCCESS),
        ("契约", "ops × 4 表面\n幂等 / dryRun", ACCENT),
        ("构建", "Vite 8 +\nelectron-vite", INK2),
        ("E2E", "Playwright\n核心旅程", ACCENT),
        ("打包", "electron-builder\ndmg + rebuild", WARN),
        ("安装验证", "全新账户\n创建 + 重启", DANGER),
        ("发布", "tag v1.0\nCHANGELOG", SUCCESS),
    ]
    x, y, w, gap = 64, 170, 104, 18
    for i, (name, desc, tint) in enumerate(stages):
        cx = x + i * (w + gap)
        s.rect(cx, y, w, 112, shadow=True)
        s.circle(cx + w / 2, y + 26, 13, fill=tint, stroke="none", opacity=0.14)
        s.text(cx + w / 2, y + 31, str(i + 1), size=11, weight=700, fill=tint, anchor="middle")
        s.text(cx + w / 2, y + 58, name, size=13, weight=700, anchor="middle")
        for j, line in enumerate(desc.split("\n")):
            s.text(cx + w / 2, y + 80 + j * 16, line, size=10, fill=INK3, anchor="middle")
        if i < len(stages) - 1:
            s.arrow([(cx + w, y + 56), (cx + w + gap, y + 56)], color=ARROW, sw=1.3)

    # gates row
    s.rect(64, 316, 900, 76, fill=SUCCESS_SOFT, stroke="none", rx=12)
    s.text(84, 344, "每次 PR 必过", size=12, weight=700, fill=SUCCESS)
    s.text(84, 368, "lint · typecheck · 单元/集成 · ops 契约 · Web 构建 · Chromium 核心旅程 e2e", size=11.5, fill=INK2)
    s.rect(984, 316, 272, 76, fill=INFO_SOFT, stroke="none", rx=12)
    s.text(1004, 344, "每晚附加", size=12, weight=700, fill=INFO)
    s.text(1004, 368, "macOS e2e · WebKit · Storybook · 依赖审计", size=11, fill=INK2)

    # release checklist
    s.rect(64, 404, 1192, 46, fill=CARD, stroke=BORDER, rx=10)
    s.text(84, 440, "发布前：数据库迁移试跑 · 快照恢复演练 · 导出/导入演练 · 真机 iPhone Safari · 1 万任务性能 · 明暗主题截图归档", size=11.5, fill=INK2)

    s.footer()
    save(s, "d7_ci_pipeline.svg")


# ---------------------------------------------------------------- D8 test pyramid
def d8():
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

# ---------------------------------------------------------------- D9 journey loop
def d9():
    s = SVG(1240, 620, "核心用户旅程闭环", "捕获 → 规划 → 执行 → 复盘 → 洞察，AI 与数据贯穿全程", "PRODUCT")
    s.title_block("PRODUCT")

    cards = [
        ("捕获", "inbox", "全局快捷键 / 速记", "收件箱 · Memo · 标签", ACCENT),
        ("规划", "calendar", "今天 · 日历 · 容量", "时间块 · 优先级 · 四象限", INFO),
        ("执行", "timer", "任务 · 看板 · 专注", "番茄钟 · 实际时长 · 状态", ACCENT),
        ("复盘", "doc", "每日收尾 · 周复盘", "完成/未完成 · 专注统计", SUCCESS),
        ("洞察", "chart", "仪表盘 · 智能复盘", "趋势 · 分布 · 需要关注", WARN),
    ]
    x0, y0, w, gap = 64, 180, 200, 26
    for i, (name, icon, sub, desc, tint) in enumerate(cards):
        x = x0 + i * (w + gap)
        s.rect(x, y0, w, 150, shadow=True)
        s.circle(x + 32, y0 + 34, 18, fill=tint + "22" if False else "#F6F3EC", stroke="none")
        s.icon(icon, x + 19, y0 + 21, color=tint, scale=0.9)
        s.text(x + 62, y0 + 40, name, size=17, weight=700, fill=INK)
        s.text(x + 20, y0 + 78, sub, size=11.5, fill=INK2)
        s.text(x + 20, y0 + 100, desc, size=10.5, fill=INK3)
        s.pill(x + 20, y0 + 116, f"0{i+1}", tint, "#F6F3EC", size=10, h=20, pad=8)
        if i < 4:
            s.arrow([(x + w, y0 + 75), (x + w + gap, y0 + 75)], color=tint, sw=1.8)

    # return loop
    s.arrow([(x0 + 4 * (w + gap) + w / 2, y0 + 150), (x0 + 4 * (w + gap) + w / 2, y0 + 190),
             (x0 + w / 2, y0 + 190), (x0 + w / 2, y0 + 150)], color=ACCENT, sw=1.6, dash="6 5",
            label="每天循环 · 周复盘回灌下周计划", lp=(x0 + 2.2 * (w + gap), y0 + 182), label_size=11)

    # bands
    s.rect(64, 420, 1112, 54, fill=ACCENT_SOFT, stroke="none", rx=10)
    s.text(84, 453, "AI 助手贯穿", size=12, weight=700, fill=ACCENT_DEEP)
    s.text(180, 453, "自然语言 → ops 工具调用：拆任务、排期、润色文档、生成复盘；所有变更需确认。", size=11.5, fill=INK2)
    s.rect(64, 488, 1112, 44, fill=INFO_SOFT, stroke="none", rx=10)
    s.text(84, 516, "数据闭环", size=12, weight=700, fill=INFO)
    s.text(180, 516, "SQLite（权威，含图片 BLOB）→ op_log（审计/撤销）→ 快照 / 导出包 → 仪表盘投影（洞察）。", size=11.5, fill=INK2)

    s.footer()
    save(s, "d9_journey_loop.svg")


# ---------------------------------------------------------------- D10 mobile access
def d10():
    s = SVG(1240, 640, "移动端访问链路", "Mac 即服务器 · 局域网 HTTPS · 证书信任 · 添加到主屏幕", "MOBILE")
    s.title_block("MOBILE")

    # mac
    s.rect(72, 160, 300, 250, shadow=True)
    s.icon("window", 92, 182, color=ACCENT)
    s.text(130, 196, "Mac · 服务", size=16, weight=700)
    s.text(92, 232, "Hono 监听", size=12, fill=INK2)
    s.text(92, 254, "127.0.0.1（默认）", size=11.5, fill=INK3)
    s.text(92, 278, "0.0.0.0 + HTTPS（LAN 模式）", size=11.5, fill=INK3)
    s.pill(92, 300, "mkcert CA", ACCENT_DEEP, ACCENT_SOFT, size=11)
    s.pill(92, 334, "6 位配对码 → 会话令牌", INK2, "#F6F3EC", size=11)
    s.pill(92, 368, "限流 · 可撤销会话", INK2, "#F6F3EC", size=11)

    # wifi
    s.circle(520, 285, 70, fill=INFO_SOFT, stroke="none", opacity=0.8)
    s.add(f'<path d="M470 285 Q520 235 570 285" fill="none" stroke="{INFO}" stroke-width="3" stroke-linecap="round"/>')
    s.add(f'<path d="M486 303 Q520 269 554 303" fill="none" stroke="{INFO}" stroke-width="3" stroke-linecap="round"/>')
    s.circle(520, 320, 6, fill=INFO, stroke="none")
    s.text(520, 360, "同一 Wi-Fi", size=12, fill=INK2, anchor="middle")
    s.text(520, 382, "HTTPS · 局域网", size=11, fill=INK3, anchor="middle")

    # phone
    s.rect(760, 140, 220, 300, shadow=True)
    s.icon("phone", 780, 162, color=ACCENT, scale=1.1)
    s.text(818, 176, "iPhone / iPad", size=15, weight=700)
    s.text(780, 212, "Safari · PWA", size=12, fill=INK2)
    s.text(780, 236, "今天 / 看板 / 速记", size=11.5, fill=INK3)
    s.text(780, 260, "触控目标 ≥ 44px", size=11.5, fill=INK3)
    s.pill(780, 282, "添加到主屏幕", ACCENT_DEEP, ACCENT_SOFT, size=11)
    s.pill(780, 316, "删除图标 = 清除站点数据", DANGER, DANGER_SOFT, size=10.5)
    s.text(780, 362, "离线：打开时冲刷队列", size=11, fill=IKN3 if False else INK3)

    # arrows
    s.arrow([(372, 260), (450, 260)], color=INFO, label="HTTPS", lp=(411, 250))
    s.arrow([(590, 260), (760, 260)], color=INFO, label=None)

    # steps
    steps = [
        ("1", "开启移动访问", "设置 → 移动访问，生成地址与配对码", ACCENT),
        ("2", "安装根证书", "下载描述文件 → 安装 → 完全信任", WARN),
        ("3", "配对登录", "输入 6 位配对码，换取会话令牌", INFO),
        ("4", "添加到主屏幕", "Safari 分享菜单 → 添加到主屏幕", SUCCESS),
    ]
    x = 72
    for i, (n, title, desc, tint) in enumerate(steps):
        s.rect(x, 456, 270, 76, fill=CARD, stroke=BORDER, rx=10)
        s.circle(x + 22, 478, 11, fill=tint, stroke="none")
        s.text(x + 22, 482, n, size=11, weight=700, fill="#FFFFFF", anchor="middle")
        s.text(x + 42, 482, title, size=12, weight=700)
        s.text(x + 18, 510, desc, size=10.5, fill=INK3)
        x += 286

    s.text(72, 560, "边界：Mac 休眠时不可用；不想装证书可改用 Tailscale（后续支持）；公网部署不在 v1.0 范围。", size=11, fill=INK3)

    s.footer()
    save(s, "d10_mobile_access.svg")


# ---------------------------------------------------------------- D11 information architecture
def d11():
    s = SVG(1240, 720, "信息架构与导航", "桌面左侧栏 · 移动端底部 Tab · 右侧上下文抽屉", "PRODUCT")
    s.title_block("PRODUCT")

    # root
    s.rect(520, 124, 200, 62, fill=ACCENT_SOFT, stroke=ACCENT, rx=14, sw=1.4)
    s.text(620, 152, "时序 · Dailywork", size=15, weight=700, fill=ACCENT_DEEP, anchor="middle")
    s.text(620, 173, "工作台", size=11, fill=INK3, anchor="middle")

    groups = [
        ("今天", ["今日任务", "逾期", "快速捕获"], 64, ACCENT, ["01"]),
        ("计划", ["日历", "时间轴", "每日容量", "每日收尾"], 254, INFO, ["02"]),
        ("任务", ["全部任务", "看板", "四象限", "模板库"], 444, ACCENT, ["03"]),
        ("项目与空间", ["项目工作台", "空间分组", "交付成果", "操作历史"], 634, SUCCESS, ["04"]),
        ("知识", ["收件箱", "速记", "文档中心"], 824, WARN, ["05"]),
        ("分析", ["仪表盘", "智能复盘"], 1014, INFO, ["06"]),
    ]
    for name, items, x, tint, nums in groups:
        s.rect(x, 240, 162, 300, fill=CARD, stroke=BORDER, rx=12, shadow=True)
        s.text(x + 18, 272, name, size=14, weight=700, fill=tint)
        s.line(x + 18, 284, x + 144, 284, color=BORDER, sw=1)
        yy = 312
        for it in items:
            s.circle(x + 24, yy - 4, 3, fill=tint, stroke="none")
            s.text(x + 36, yy, it, size=11.5, fill=INK2)
            yy += 32
        s.pill(x + 18, 500, nums[0], tint, "#F6F3EC", size=10, h=20, pad=8)
        s.arrow([(620, 186), (x + 81, 240)], color=BORDER_STRONG, sw=1.2)

    # right drawer note
    s.rect(64, 580, 500, 74, fill=CARD, stroke=BORDER, rx=12)
    s.text(84, 606, "右侧上下文抽屉（桌面 ≥1024px）", size=12, weight=700)
    s.text(84, 630, "详情 · 子待办 · 记录 · 备注/附件 · 专注卡片；<1024px 改为 Sheet。", size=11, fill=INK3)

    # mobile tab note
    s.rect(584, 580, 592, 74, fill=ACCENT_SOFT, stroke="none", rx=12)
    s.text(604, 606, "移动端底部 Tab", size=12, weight=700, fill=ACCENT_DEEP)
    s.text(604, 630, "今天 · 计划 · 看板 · 文档 · 更多；详情全屏，速记浮动按钮。", size=11, fill=INK2)

    s.footer()
    save(s, "d11_information_architecture.svg")


def d12():
    s = SVG(1240, 700, "任务域数据模型", "空间 · 项目 · 任务 · 时间块 · 专注 · 速记", "DATA")
    s.title_block("DATA")

    def entity(x, y, w, h, name, rows, tint=INK):
        s.rect(x, y, w, h, shadow=True)
        s.text(x + 16, y + 26, name, size=13.5, weight=700, fill=tint)
        s.line(x + 16, y + 38, x + w - 16, y + 38, color=BORDER, sw=1)
        yy = y + 58
        for label, typ, key in rows:
            s.text(x + 16, yy, label, size=10, fill=INK2)
            key_w = (tw(key, 8.5) + 12) if key else 0
            s.text(x + w - 16 - key_w - 8, yy, typ, size=9.5, fill=INK3, anchor="end")
            if key:
                s.pill(x + w - 16 - key_w, yy - 12, key, ACCENT_DEEP if key == "PK" else INFO,
                       ACCENT_SOFT if key == "PK" else INFO_SOFT, size=8.5, h=16, pad=6)
            yy += 19

    entity(60, 200, 240, 150, "SPACE", [("id", "string", "PK"), ("name", "string", ""), ("color", "string", ""), ("icon", "string", ""), ("sort_order", "int", "")])
    entity(370, 200, 260, 170, "PROJECT", [("id", "string", "PK"), ("space_id", "string", "FK"), ("name", "string", ""), ("status", "string", ""), ("due_at", "datetime", ""), ("acceptance", "string", "")])
    entity(710, 170, 300, 280, "TASK", [("id", "string", "PK"), ("space_id", "string", "FK"), ("project_id", "string", "FK"), ("parent_id", "string", "FK"), ("title", "string", ""), ("status", "string", ""), ("priority", "string", ""), ("due_at", "datetime", ""), ("estimate_min", "int", ""), ("actual_min", "int", ""), ("version", "int", "")])
    entity(60, 430, 240, 150, "MEMO", [("id", "string", "PK"), ("content", "text", ""), ("tags_json", "json", ""), ("converted_task_id", "string", "FK"), ("created_at", "datetime", "")])
    entity(370, 450, 260, 140, "SCHEDULE_ENTRY", [("id", "string", "PK"), ("task_id", "string", "FK"), ("start_at", "datetime", ""), ("end_at", "datetime", "")])
    entity(710, 490, 270, 150, "FOCUS_SESSION", [("id", "string", "PK"), ("task_id", "string", "FK"), ("started_at", "datetime", ""), ("planned_min", "int", ""), ("actual_min", "int", "")])

    s.arrow([(300, 255), (370, 255)], color=ARROW, label="1:N", lp=(335, 245), label_size=9)
    s.arrow([(630, 255), (710, 255)], color=ARROW, label="1:N", lp=(670, 245), label_size=9)
    s.arrow([(180, 350), (180, 430)], color=ARROW, label="1:N", lp=(210, 392), label_size=9)
    s.arrow([(760, 450), (760, 465), (640, 465), (640, 560), (630, 560)], color=ARROW, label="1:N", lp=(700, 552), label_size=9)
    s.arrow([(900, 450), (900, 490)], color=ARROW, label="1:N", lp=(930, 472), label_size=9)
    s.arrow([(1010, 220), (1040, 220), (1040, 380), (1010, 380)], color=ARROW, label="子任务", lp=(1062, 300), label_size=9)

    s.text(72, 620, "任务删除为软删除；状态机与子任务进度汇总由 tasking 维护；时间块只引用 taskId，不复制任务字段。", size=11, fill=INK3)
    s.footer()
    save(s, "d12_task_er.svg")

def d13():
    s = SVG(1100, 560, "知识与附件数据模型", "文档元数据 · Yjs 正文 · 附件 BLOB", "DATA")
    s.title_block("DATA")

    def entity(x, y, w, h, name, rows, tint=INK):
        s.rect(x, y, w, h, shadow=True)
        s.text(x + 16, y + 26, name, size=13.5, weight=700, fill=tint)
        s.line(x + 16, y + 38, x + w - 16, y + 38, color=BORDER, sw=1)
        yy = y + 58
        for label, typ, key in rows:
            s.text(x + 16, yy, label, size=10, fill=INK2)
            key_w = (tw(key, 8.5) + 12) if key else 0
            s.text(x + w - 16 - key_w - 8, yy, typ, size=9.5, fill=INK3, anchor="end")
            if key:
                s.pill(x + w - 16 - key_w, yy - 12, key, ACCENT_DEEP if key == "PK" else INFO,
                       ACCENT_SOFT if key == "PK" else INFO_SOFT, size=8.5, h=16, pad=6)
            yy += 19

    entity(72, 170, 260, 230, "DOCUMENT", [("id", "string", "PK"), ("title", "string", ""), ("space_id", "string", "FK"), ("project_id", "string", "FK"), ("task_id", "string", "FK"), ("parent_id", "string", "FK"), ("yjs_doc_id", "string", ""), ("deleted_at", "datetime", "")])
    entity(420, 200, 250, 180, "ATTACHMENTS", [("id", "string", "PK"), ("owner_type", "string", ""), ("owner_id", "string", "FK"), ("blob_id", "string", "FK"), ("filename", "string", ""), ("sort_order", "int", "")])
    entity(760, 170, 270, 230, "BLOBS", [("id", "string", "PK"), ("sha256", "string", "UQ"), ("mime", "string", ""), ("bytes", "int", ""), ("width", "int", ""), ("height", "int", ""), ("data", "blob", ""), ("thumb_data", "blob", "")])

    s.arrow([(332, 285), (420, 285)], color=ARROW, label="1:N 引用", lp=(376, 275), label_size=9)
    s.arrow([(670, 285), (760, 285)], color=ARROW, label="N:1 blob_id", lp=(715, 275), label_size=9)
    s.arrow([(72, 230), (40, 230), (40, 390), (72, 390)], color=ARROW, label="子文档", lp=(28, 310), label_size=9)

    s.rect(420, 410, 610, 76, fill=CARD, stroke=BORDER, rx=12)
    s.text(440, 436, "引用与清理", size=11.5, weight=700, fill=ACCENT_DEEP)
    s.text(440, 458, "正文只保存 attachmentId；删除引用不立即删 blob，无引用后由后台 GC 清理。", size=10.5, fill=INK2)
    s.text(440, 476, "导出包包含 blobs.data 与 thumb_data；不保存外部路径；不接受 SVG。", size=10.5, fill=INK3)

    s.footer()
    save(s, "d13_content_er.svg")

if __name__ == "__main__":
    d1(); d2(); d3(); d4(); d5(); d6(); d7(); d8(); d9(); d10(); d11(); d12(); d13()
    print("done")
