import { randomBytes, randomInt } from 'node:crypto'
import { writeFileSync, unlinkSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { applyPendingImport, createLogger, dataPaths, ensureDailyBackup, ensureDataDirs, resolveDataDir } from '@daily/platform'
import { cleanupStaleFocus } from '@daily/context-focus'
import { createApp, launchHttp } from './app.js'

export interface StartedServer {
  url: string
  port: number
  token: string
  close: () => Promise<void>
}

export async function startServer(opts: {
  dataDir?: string
  port?: number
  host?: string
  webDist?: string
  writeRuntime?: boolean
} = {}): Promise<StartedServer> {
  const dataDir = resolveDataDir(opts.dataDir)
  const paths = dataPaths(dataDir)
  ensureDataDirs(paths)
  const applied = applyPendingImport(dataDir)

  const version = process.env.DAILYWORK_VERSION ?? '0.1.0'
  const logger = createLogger(paths)
  const token = randomBytes(24).toString('base64url')
  const pairingCode = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const bundle = createApp({
    dataDir,
    token,
    webDist: opts.webDist ?? process.env.DAILYWORK_WEB_DIST,
    port: opts.port,
    pairingCode,
    version,
  })
  cleanupStaleFocus(bundle.db)
  try {
    const daily = ensureDailyBackup(bundle.db, dataDir, version)
    if (daily) logger.info({ path: daily.path }, 'daily backup created')
  } catch (error) {
    logger.warn({ error }, 'daily backup failed')
  }
  const host = opts.host ?? process.env.DAILYWORK_HOST ?? '127.0.0.1'
  const port = opts.port ?? Number(process.env.DAILYWORK_PORT ?? 0)
  const server = await launchHttp(bundle.app, port, host)
  const address = server.address() as AddressInfo
  bundle.setPort(address.port)
  const displayHost = host === '0.0.0.0' ? '127.0.0.1' : host
  const url = `http://${displayHost}:${address.port}`

  if (opts.writeRuntime !== false) {
    writeFileSync(
      paths.runtimeFile,
      JSON.stringify(
        {
          url,
          port: address.port,
          host,
          token,
          pairingCode,
          pid: process.pid,
          version,
          startedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      { mode: 0o600 },
    )
  }
  if (applied.applied) logger.info({ backupPath: applied.backupPath }, 'applied pending import')
  logger.info({ url, dataDir }, 'dailywork server ready')
  console.log(`[dailywork] listening on ${url}`)
  console.log(`[dailywork] data: ${paths.dbFile}`)

  const close = async () => {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()))
    bundle.closeDb()
    if (opts.writeRuntime !== false) {
      try {
        unlinkSync(paths.runtimeFile)
      } catch {
        // already removed
      }
    }
  }

  return { url, port: address.port, token, close }
}

startServer({ webDist: process.env.DAILYWORK_WEB_DIST }).then((started) => {
  const shutdown = async () => {
    await started.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
})
