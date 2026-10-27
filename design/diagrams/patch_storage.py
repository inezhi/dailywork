#!/usr/bin/env python3
"""Update diagrams for local-storage architecture (no iCloud)."""
import re

P = "gen_diagrams.py"
s = open(P, encoding="utf-8").read()

# d1
s = s.replace('s = SVG(1240, 720, "系统上下文", "C4 Level 1 · macOS 单机权威 + iCloud 备份 + 局域网移动端", "ARCHITECTURE")',
              's = SVG(1240, 720, "系统上下文", "C4 Level 1 · macOS 单机权威 + 备份/导出 + 局域网移动端", "ARCHITECTURE")')
old_card = '''    # iCloud
    s.rect(742, 262, 186, 136, shadow=True)
    s.icon("cloud", 758, 278, color=INFO, scale=1.1)
    s.text(800, 292, "iCloud Drive", size=16, weight=700)
    s.text(758, 320, "Dailywork/", size=12, fill=INK2)
    s.pill(758, 332, "ops 分段", INFO, INFO_SOFT, size=11)
    s.pill(826, 332, "快照", INFO, INFO_SOFT, size=11)
    s.pill(758, 364, "附件 blob", INFO, INFO_SOFT, size=11)'''
new_card = '''    # local backup
    s.rect(742, 262, 186, 150, shadow=True)
    s.icon("db", 758, 278, color=INFO, scale=1.1)
    s.text(800, 292, "备份", size=16, weight=700)
    s.text(758, 320, "Dailywork/backup", size=11.5, fill=INK2)
    s.pill(758, 334, "VACUUM INTO", INFO, INFO_SOFT, size=10)
    s.pill(758, 366, ".dailywork 导出", INFO, INFO_SOFT, size=10)
    s.text(758, 400, "含图片 BLOB · 可导入恢复", size=10.5, fill=INK3)'''
assert old_card in s
s = s.replace(old_card, new_card, 1)
s = s.replace('color=INFO, label="备份", lp=(674, 310)', 'color=INFO, label="快照", lp=(674, 310)')
s = s.replace('color=INFO, label="恢复", lp=(674, 335)', 'color=INFO, label="导入恢复", lp=(674, 335)')
s = s.replace('AI Key 只存 Keychain；iCloud 不存活数据库。', 'AI Key 只存 Keychain；图片以 BLOB 存 SQLite；导出包含图片。')

# d2
s = s.replace('("platform/", ["SQLite · migrations · Keychain", "SyncTransport · logging"], INFO, 92),',
              '("platform/", ["SQLite · migrations · Keychain", "BackupService · logging"], INFO, 92),')
old_data = '''        ("iCloud Drive", "密封分段 · 快照 · blob", INFO_SOFT, INFO),
        ("Keychain", "AI Key · safeStorage", WARN_SOFT, WARN),
        ("daily token", "0600 文件 · 设备鉴权", "#F6F3EC", INK2),'''
new_data = '''        ("图片 BLOB", "blobs / attachments · sha256 去重", INFO_SOFT, INFO),
        ("快照 / 导出包", "VACUUM INTO · .dailywork", INFO_SOFT, INFO),
        ("Keychain", "AI Key · safeStorage", WARN_SOFT, WARN),
        ("daily token", "0600 文件 · 设备鉴权", "#F6F3EC", INK2),'''
assert old_data in s
s = s.replace(old_data, new_data, 1)

# d3
s = s.replace('支撑子系统（只读 / 平台能力，不作为核心域） · analytics 订阅 outbox；sync 只复制 op_log',
              '支撑子系统（只读 / 平台能力，不作为核心域） · analytics 订阅 outbox；backup 负责快照与导出/导入')
s = s.replace('("sync", "op_log 复制与恢复", INFO, INFO_SOFT)', '("backup", "快照 · 导出/导入", INFO, INFO_SOFT)')

# d9
s = s.replace('SQLite（权威）→ op_log（审计/同步）→ iCloud 快照（备份）→ 仪表盘投影（洞察）。',
              'SQLite（权威，含图片 BLOB）→ op_log（审计/撤销）→ 快照 / 导出包 → 仪表盘投影（洞察）。')

# d7
s = s.replace('快照恢复演练 · iCloud TCC 授权 · 真机 iPhone Safari', '快照恢复演练 · 导出/导入演练 · 真机 iPhone Safari')

# d4 replace whole function
D4 = r'''def d4():
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

'''
pat = re.compile(r"def d4\(\):.*?\n# -+ D5 ops surfaces", re.S)
assert pat.search(s)
s = pat.sub(D4 + "# ---------------------------------------------------------------- D5 ops surfaces", s, count=1)

# add d12/d13 before main
D12 = r'''def d12():
    s = SVG(1240, 700, "任务域数据模型", "空间 · 项目 · 任务 · 时间块 · 专注 · 速记", "DATA")
    s.title_block("DATA")

    def entity(x, y, w, h, name, rows, tint=INK):
        s.rect(x, y, w, h, shadow=True)
        s.text(x + 16, y + 26, name, size=13.5, weight=700, fill=tint)
        s.line(x + 16, y + 38, x + w - 16, y + 38, color=BORDER, sw=1)
        yy = y + 58
        for label, typ, key in rows:
            s.text(x + 16, yy, label, size=10, fill=INK2)
            s.text(x + w - 16, yy, typ, size=9.5, fill=INK3, anchor="end")
            if key:
                s.pill(x + w - 58, yy - 12, key, ACCENT_DEEP if key == "PK" else INFO,
                       ACCENT_SOFT if key == "PK" else INFO_SOFT, size=8.5, h=16, pad=6)
            yy += 19

    entity(72, 200, 220, 140, "SPACE", [("id", "string", "PK"), ("name", "string", ""), ("color", "string", ""), ("icon", "string", ""), ("sort_order", "int", "")])
    entity(360, 200, 240, 170, "PROJECT", [("id", "string", "PK"), ("space_id", "string", "FK"), ("name", "string", ""), ("status", "string", ""), ("due_at", "datetime", ""), ("acceptance", "string", "")])
    entity(720, 180, 280, 260, "TASK", [("id", "string", "PK"), ("space_id", "string", "FK"), ("project_id", "string", "FK"), ("parent_id", "string", "FK"), ("title", "string", ""), ("status", "string", ""), ("priority", "string", ""), ("due_at", "datetime", ""), ("estimate_min", "int", ""), ("actual_min", "int", ""), ("version", "int", "")])
    entity(72, 430, 220, 150, "MEMO", [("id", "string", "PK"), ("content", "text", ""), ("tags_json", "json", ""), ("converted_task_id", "string", "FK"), ("created_at", "datetime", "")])
    entity(360, 450, 240, 140, "SCHEDULE_ENTRY", [("id", "string", "PK"), ("task_id", "string", "FK"), ("start_at", "datetime", ""), ("end_at", "datetime", "")])
    entity(720, 490, 250, 140, "FOCUS_SESSION", [("id", "string", "PK"), ("task_id", "string", "FK"), ("started_at", "datetime", ""), ("planned_min", "int", ""), ("actual_min", "int", "")])

    s.arrow([(292, 255), (360, 255)], color=ARROW, label="1:N", lp=(326, 245), label_size=9)
    s.arrow([(600, 255), (720, 255)], color=ARROW, label="1:N", lp=(660, 245), label_size=9)
    s.arrow([(182, 340), (182, 430)], color=ARROW, label="1:N", lp=(212, 388), label_size=9)
    s.arrow([(800, 440), (800, 520), (600, 520)], color=ARROW, label="1:N", lp=(700, 510), label_size=9)
    s.arrow([(900, 440), (900, 490)], color=ARROW, label="1:N", lp=(930, 468), label_size=9)
    s.arrow([(1000, 220), (1030, 220), (1030, 380), (1000, 380)], color=ARROW, label="子任务", lp=(1050, 300), label_size=9)

    s.text(72, 620, "任务删除为软删除；状态机与子任务进度汇总由 tasking 维护；时间块只引用 taskId，不复制任务字段。", size=11, fill=INK3)
    s.footer()
    save(s, "d12_task_er.svg")

'''
D13 = r'''def d13():
    s = SVG(1100, 560, "知识与附件数据模型", "文档元数据 · Yjs 正文 · 附件 BLOB", "DATA")
    s.title_block("DATA")

    def entity(x, y, w, h, name, rows, tint=INK):
        s.rect(x, y, w, h, shadow=True)
        s.text(x + 16, y + 26, name, size=13.5, weight=700, fill=tint)
        s.line(x + 16, y + 38, x + w - 16, y + 38, color=BORDER, sw=1)
        yy = y + 58
        for label, typ, key in rows:
            s.text(x + 16, yy, label, size=10, fill=INK2)
            s.text(x + w - 16, yy, typ, size=9.5, fill=INK3, anchor="end")
            if key:
                s.pill(x + w - 58, yy - 12, key, ACCENT_DEEP if key == "PK" else INFO,
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

'''
anchor = "if __name__ == \"__main__\":"
assert anchor in s
s = s.replace(anchor, D12 + D13 + anchor, 1)
s = s.replace('d1(); d2(); d3(); d4(); d5(); d6(); d7(); d8(); d9(); d10(); d11()',
              'd1(); d2(); d3(); d4(); d5(); d6(); d7(); d8(); d9(); d10(); d11(); d12(); d13()')

open(P, "w", encoding="utf-8").write(s)
print("patched")
