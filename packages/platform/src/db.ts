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
    setMeta(db, 'seeded', '1')
    setMeta(db, 'created_at', at)
  })
}

export function openDatabaseFromPaths(paths: { dbFile: string }): Db {
  return openDatabase(paths.dbFile)
}

export { nowIso }
