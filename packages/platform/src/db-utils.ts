import type { DatabaseSync } from 'node:sqlite'

export type Db = DatabaseSync

export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    try {
      db.exec('ROLLBACK')
    } catch {
      // The transaction may already have been rolled back by SQLite.
    }
    throw error
  }
}

export interface OpLogEntry {
  opId: string
  ts: string
  actor: string
  source: string
  command: string
  aggregateType: string
  aggregateId: string
  summary?: string
  payload?: unknown
  after?: unknown
}

/** Append an audit entry inside the caller's transaction. Duplicate opIds are ignored. */
export function recordOp(db: Db, entry: OpLogEntry): void {
  db.prepare(
    `INSERT INTO op_log(op_id, ts, actor, source, command, aggregate_type, aggregate_id, summary, payload_json, after_json)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(op_id) DO NOTHING`,
  ).run(
    entry.opId,
    entry.ts,
    entry.actor,
    entry.source,
    entry.command,
    entry.aggregateType,
    entry.aggregateId,
    entry.summary ?? '',
    JSON.stringify(entry.payload ?? {}),
    entry.after == null ? null : JSON.stringify(entry.after),
  )
}

export interface OpLogRecord {
  opId: string
  command: string
  aggregateType: string
  aggregateId: string
  afterJson: string | null
}

export function findOpLog(db: Db, opId: string): OpLogRecord | null {
  const row = db
    .prepare(
      `SELECT op_id AS opId, command, aggregate_type AS aggregateType,
              aggregate_id AS aggregateId, after_json AS afterJson
       FROM op_log WHERE op_id = ?`,
    )
    .get(opId) as OpLogRecord | undefined
  return row ?? null
}

export function getMeta(db: Db, key: string): string | null {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

export function setMeta(db: Db, key: string, value: string): void {
  db.prepare(
    `INSERT INTO meta(key, value) VALUES(?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value)
}

export function getSetting<T>(db: Db, key: string, fallback: T): T {
  const row = db.prepare('SELECT value_json FROM settings WHERE key = ?').get(key) as
    | { value_json: string }
    | undefined
  if (!row) return fallback
  try {
    return JSON.parse(row.value_json) as T
  } catch {
    return fallback
  }
}

export function setSetting(db: Db, key: string, value: unknown, at: string): void {
  db.prepare(
    `INSERT INTO settings(key, value_json, updated_at) VALUES(?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
  ).run(key, JSON.stringify(value), at)
}
