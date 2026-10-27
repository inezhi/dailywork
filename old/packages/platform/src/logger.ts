import pino from 'pino'
import { createWriteStream } from 'node:fs'
import { join } from 'node:path'
import type { DataPaths } from './paths.js'

export type Logger = pino.Logger

let logger: Logger | null = null

export function createLogger(paths?: DataPaths, level = process.env.DAILYWORK_LOG_LEVEL ?? 'info') {
  if (logger) return logger
  if (process.env.NODE_ENV === 'test') {
    logger = pino({ level: 'silent' })
    return logger
  }
  const options: pino.LoggerOptions = {
    level,
    base: { app: 'dailywork' },
    timestamp: pino.stdTimeFunctions.isoTime,
  }
  if (paths) {
    const stream = pino.multistream([
      { level, stream: process.stdout },
      { level, stream: createWriteStream(join(paths.logsDir, 'dailywork.log'), { flags: 'a' }) },
    ])
    logger = pino(options, stream)
  } else {
    logger = pino(options)
  }
  return logger
}

export function log(): Logger {
  return logger ?? createLogger(undefined)
}
