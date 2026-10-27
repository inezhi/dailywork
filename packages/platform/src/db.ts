import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { MIGRATION_1, MIGRATION_2 } from './migrations/v1.js'
import { setMeta, setSetting, transaction, getMeta } from './db-utils.js'
import { nowIso } from './time.js'
import type { Db } from './db-utils.js'

export type { Db } from './db-utils.js'

export const SCHEMA_VERSION = 2

const MIGRATIONS: Array<{ version: number; sql: string }> = [
  { version: 1, sql: MIGRATION_1 },
  { version: 2, sql: MIGRATION_2 },
]

export function openDatabase(file: string): Db {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec('PRAGMA synchronous = NORMAL')
  migrate(db)
  seed(db)
  return db
}

export function closeDatabase(db: Db): void {
  try {
    db.close()
  } catch {
    // already closed
  }
}

export function migrate(db: Db): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)',
  )
  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>).map(
      (r) => r.version,
    ),
  )
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue
    transaction(db, () => {
      db.exec(migration.sql)
      db.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)').run(
        migration.version,
        nowIso(),
      )
    })
  }
  setMeta(db, 'schema_version', String(SCHEMA_VERSION))
}

export function seed(db: Db): void {
  if (getMeta(db, 'seeded') === '1') return
  const at = nowIso()
  transaction(db, () => {
    db.prepare(
      `INSERT INTO spaces(id, name, color, icon, sort_order, created_at, updated_at)
       VALUES(?, ?, ?, ?, ?, ?, ?)`,
    ).run('spc_default', '个人空间', '#D97757', 'layers', 0, at, at)

    setSetting(
      db,
      'theme',
      {
        mode: 'light',
        accent: '#D97757',
        success: '#788C5D',
        warning: '#A8761C',
        danger: '#B5473C',
        info: '#6A9BCC',
        neutral: 'warm',
        density: 'comfortable',
      },
      at,
    )
    setSetting(
      db,
      'general',
      {
        weekStartsOn: 1,
        defaultFocusMinutes: 25,
        defaultCapacityMinutes: 300,
        aiEnabled: true,
        lanEnabled: false,
        reduceMotion: false,
      },
      at,
    )
    const welcomeText =
      '欢迎使用时序。时序不是又一个任务清单，而是把任务、时间、专注与知识放进同一个闭环的工作台。先写下今天最重要的一件事，再给它一个时长，然后开始一段专注。需要更多结构时，把任务放进项目与日期；想法先丢进速记；周末在仪表盘回看。所有数据只保存在这台 Mac 上，可在设置中导出完整备份。'
    const welcomeContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: '欢迎使用时序' }] },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '时序把任务、时间、专注与知识放进同一个闭环。它不追求让你做更多，而是让重要的那件事更容易开始。',
            },
          ],
        },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '今天' }] },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: '写下今天最重要的一件事，估一个时长。' }] },
              ],
            },
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: '在「今天」页调整容量，只安排真正做得完的事。' }] },
              ],
            },
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: '点开任务，开始一段 25 分钟专注；结束后会自动记录实际投入。' }] },
              ],
            },
          ],
        },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '捕获与整理' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '碎片想法先放进「速记」，用 #标签 归类；想清楚后再一键转为任务。收件箱只放还没决定下一步的东西，定期清空。' },
          ],
        },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '数据与备份' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '全部数据（含文档图片）都保存在本机 SQLite。设置 → 数据与备份可以导出 .dailywork 完整备份，或导入到新机器。' },
          ],
        },
        {
          type: 'blockquote',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: '时间有序，专注有度。' }] },
          ],
        },
      ],
    }
    db.prepare(
      `INSERT INTO documents(id, title, icon, excerpt, sort_order, created_at, updated_at)
       VALUES(?, ?, ?, ?, ?, ?, ?)`,
    ).run('doc_welcome', '欢迎使用时序', 'sparkles', welcomeText.slice(0, 160), 0, at, at)
    db.prepare(
      'INSERT INTO document_bodies(document_id, content_json, text, updated_at) VALUES(?, ?, ?, ?)',
    ).run('doc_welcome', JSON.stringify(welcomeContent), welcomeText, at)

    setMeta(db, 'seeded', '1')
    setMeta(db, 'created_at', at)
  })
}

export function openDatabaseFromPaths(paths: { dbFile: string }): Db {
  return openDatabase(paths.dbFile)
}

export { nowIso }
