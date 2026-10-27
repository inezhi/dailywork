import { DatabaseSync } from 'node:sqlite'
import {
  copyFileSync,
  readdirSync,
  statSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { zipSync, unzipSync } from 'fflate'
import type { Db } from './db-utils.js'
import { SCHEMA_VERSION } from './db.js'
import { dataPaths, ensureDataDirs } from './paths.js'
import { nowIso, toDateOnly } from './time.js'

export interface BackupManifest {
  format: 'dailywork'
  formatVersion: 1
  schemaVersion: number
  appVersion: string
  createdAt: string
  counts: {
    tasks: number
    projects: number
    documents: number
    memos: number
    attachments: number
    blobs: number
  }
}

export interface BackupResult {
  path: string
  bytes: number
}

export interface ImportInspection {
  manifest: BackupManifest
  data: Uint8Array
  secrets?: Uint8Array
}

function counts(db: Db): BackupManifest['counts'] {
  const one = (table: string) =>
    (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c
  return {
    tasks: one('tasks'),
    projects: one('projects'),
    documents: one('documents'),
    memos: one('memos'),
    attachments: one('attachments'),
    blobs: one('blobs'),
  }
}

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${toDateOnly(d).replaceAll('-', '')}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export function exportBackup(
  db: Db,
  dataDir: string,
  appVersion: string,
  targetPath?: string,
): BackupResult {
  const paths = dataPaths(dataDir)
  ensureDataDirs(paths)
  const tmp = join(paths.dataDir, `.backup-${process.pid}-${Date.now()}.sqlite`)
  try {
    db.exec(`VACUUM INTO '${tmp.replaceAll("'", "''")}'`)
    const data = new Uint8Array(readFileSync(tmp))
    const manifest: BackupManifest = {
      format: 'dailywork',
      formatVersion: 1,
      schemaVersion: Number(
        (db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
          | { value: string }
          | undefined)?.value ?? 1,
      ),
      appVersion,
      createdAt: nowIso(),
      counts: counts(db),
    }
    const entries: Record<string, Uint8Array> = {
      'data.sqlite': data,
      'manifest.json': new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
      'README.txt': new TextEncoder().encode(
        '时序 · Dailywork 备份文件。\n包含本地 SQLite 数据库（任务、项目、文档、附件图片与审计日志）以及加密 AI 密钥的本地密钥文件。\n通过 设置 → 数据与备份 → 导入备份 恢复。请妥善保管此文件。\n',
      ),
    }
    const secretsFile = join(paths.dataDir, 'secrets.key')
    if (existsSync(secretsFile)) entries['secrets.key'] = new Uint8Array(readFileSync(secretsFile))
    const zipped = zipSync(entries, { level: 6 })
    const out =
      targetPath ?? join(paths.backupsDir, `dailywork-${stamp()}.dailywork`)
    mkdirSync(out.slice(0, out.lastIndexOf('/')) || paths.backupsDir, { recursive: true })
    writeFileSync(out, zipped, { mode: 0o600 })
    return { path: out, bytes: zipped.byteLength }
  } finally {
    try {
      unlinkSync(tmp)
    } catch {
      // ignore
    }
  }
}

export function inspectBackup(sourcePath: string): ImportInspection {
  if (!existsSync(sourcePath)) throw new Error('备份文件不存在')
  const raw = readFileSync(sourcePath)
  if (raw.byteLength > 4 * 1024 * 1024 * 1024) throw new Error('备份文件过大')
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(raw))
  } catch {
    throw new Error('不是有效的 .dailywork 备份文件')
  }
  const manifestBytes = files['manifest.json']
  const data = files['data.sqlite']
  if (!manifestBytes || !data) throw new Error('备份缺少 manifest.json 或 data.sqlite')
  let manifest: BackupManifest
  try {
    manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as BackupManifest
  } catch {
    throw new Error('备份清单无法解析')
  }
  if (manifest.format !== 'dailywork' || manifest.formatVersion !== 1) {
    throw new Error('不支持的备份格式')
  }
  const tmp = join(process.env.TMPDIR ?? '/tmp', `dailywork-verify-${process.pid}-${Date.now()}.sqlite`)
  try {
    writeFileSync(tmp, data)
    const db = new DatabaseSync(tmp)
    const check = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string }
    const version = db
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value: string } | undefined
    db.close()
    if (check.integrity_check !== 'ok') throw new Error('备份数据库完整性校验失败')
    if (Number(version?.value ?? 0) > SCHEMA_VERSION) throw new Error('备份来自更新的版本，请先升级应用')
  } finally {
    try {
      unlinkSync(tmp)
    } catch {
      // ignore
    }
  }
  return { manifest, data, secrets: files['secrets.key'] }
}

export function stageImport(dataDir: string, sourcePath: string): ImportInspection & { pendingPath: string } {
  const inspection = inspectBackup(sourcePath)
  const paths = dataPaths(dataDir)
  ensureDataDirs(paths)
  const pendingPath = join(paths.dataDir, 'data.sqlite.import-pending')
  writeFileSync(pendingPath, inspection.data, { mode: 0o600 })
  if (inspection.secrets) {
    writeFileSync(join(paths.dataDir, 'secrets.key.import-pending'), inspection.secrets, {
      mode: 0o600,
    })
  }
  writeFileSync(
    join(paths.dataDir, 'import-pending.json'),
    JSON.stringify({ stagedAt: nowIso(), sourcePath, manifest: inspection.manifest }, null, 2),
    { mode: 0o600 },
  )
  return { ...inspection, pendingPath }
}

export function applyPendingImport(dataDir: string): { applied: boolean; backupPath?: string } {
  const paths = dataPaths(dataDir)
  const pending = join(paths.dataDir, 'data.sqlite.import-pending')
  const marker = join(paths.dataDir, 'import-pending.json')
  if (!existsSync(pending) || !existsSync(marker)) return { applied: false }
  ensureDataDirs(paths)
  let backupPath: string | undefined
  if (existsSync(paths.dbFile)) {
    backupPath = join(paths.backupsDir, `before-import-${stamp()}.sqlite`)
    copyFileSync(paths.dbFile, backupPath)
  }
  for (const suffix of ['-wal', '-shm']) {
    try {
      rmSync(paths.dbFile + suffix, { force: true })
    } catch {
      // ignore
    }
  }
  renameSync(pending, paths.dbFile)
  const pendingSecrets = join(paths.dataDir, 'secrets.key.import-pending')
  if (existsSync(pendingSecrets)) {
    const secretsBackup = join(paths.backupsDir, `before-import-${stamp()}.secrets.key`)
    if (existsSync(join(paths.dataDir, 'secrets.key'))) {
      copyFileSync(join(paths.dataDir, 'secrets.key'), secretsBackup)
    }
    renameSync(pendingSecrets, join(paths.dataDir, 'secrets.key'))
  }
  rmSync(marker, { force: true })
  return { applied: true, backupPath }
}


export function ensureDailyBackup(
  db: Db,
  dataDir: string,
  appVersion: string,
  keep = 14,
): BackupResult | null {
  const paths = dataPaths(dataDir)
  ensureDataDirs(paths)
  const prefix = `dailywork-${toDateOnly(new Date()).replaceAll('-', '')}`
  const existing = readdirSync(paths.backupsDir).filter(
    (name) => name.startsWith(prefix) && name.endsWith('.dailywork'),
  )
  let result: BackupResult | null = null
  if (existing.length === 0) {
    result = exportBackup(db, dataDir, appVersion)
  }
  try {
    const files = readdirSync(paths.backupsDir)
      .filter((name) => name.startsWith('dailywork-') && name.endsWith('.dailywork'))
      .map((name) => ({
        name,
        at: statSync(join(paths.backupsDir, name)).mtimeMs,
      }))
      .sort((a, b) => b.at - a.at)
    for (const stale of files.slice(keep)) {
      unlinkSync(join(paths.backupsDir, stale.name))
    }
  } catch {
    // retention is best-effort
  }
  return result
}
