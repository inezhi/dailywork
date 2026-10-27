import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

export interface DataPaths {
  dataDir: string
  dbFile: string
  runtimeFile: string
  backupsDir: string
  logsDir: string
}

export function resolveDataDir(explicit?: string): string {
  const dir =
    explicit ??
    process.env.DAILYWORK_DATA_DIR ??
    join(homedir(), 'Library', 'Application Support', 'Dailywork')
  return resolve(dir)
}

export function dataPaths(explicit?: string): DataPaths {
  const dataDir = resolveDataDir(explicit)
  return {
    dataDir,
    dbFile: join(dataDir, 'data.sqlite'),
    runtimeFile: join(dataDir, 'runtime.json'),
    backupsDir: join(dataDir, 'backups'),
    logsDir: join(dataDir, 'logs'),
  }
}

export function ensureDataDirs(paths: DataPaths): void {
  for (const dir of [paths.dataDir, paths.backupsDir, paths.logsDir]) {
    mkdirSync(dir, { recursive: true, mode: 0o700 })
  }
}
