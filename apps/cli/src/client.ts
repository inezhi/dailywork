import { existsSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { dataPaths, resolveDataDir } from '@daily/platform'

export interface RuntimeInfo {
  url: string
  port: number
  token: string
}

export function readRuntime(dataDir: string): RuntimeInfo | null {
  const paths = dataPaths(dataDir)
  if (!existsSync(paths.runtimeFile)) return null
  try {
    return JSON.parse(readFileSync(paths.runtimeFile, 'utf8')) as RuntimeInfo
  } catch {
    return null
  }
}

export async function isHealthy(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1200) })
    return res.ok
  } catch {
    return false
  }
}

export function findServerBin(): string | null {
  const candidates = [
    process.env.DAILYWORK_SERVER_BIN,
    join(process.cwd(), 'apps/server/dist/server.mjs'),
    new URL('../../server/dist/server.mjs', import.meta.url).pathname,
    new URL('../../../apps/server/dist/server.mjs', import.meta.url).pathname,
  ].filter(Boolean) as string[]
  return candidates.find((p) => existsSync(p)) ?? null
}

export async function ensureServer(dataDir: string): Promise<RuntimeInfo> {
  const explicit = process.env.DAILYWORK_URL
  if (explicit && (await isHealthy(explicit))) {
    return { url: explicit, port: Number(new URL(explicit).port || 47821), token: '' }
  }
  const existing = readRuntime(dataDir)
  if (existing && (await isHealthy(existing.url))) return existing
  const bin = findServerBin()
  if (!bin) {
    throw new Error(
      '本地服务未运行，且找不到 server 构建产物。请先运行 pnpm build（或启动桌面应用）后再试。',
    )
  }
  const child = spawn(process.execPath, [bin], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, DAILYWORK_DATA_DIR: dataDir },
  })
  child.unref()
  for (let i = 0; i < 60; i++) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    const runtime = readRuntime(dataDir)
    if (runtime && (await isHealthy(runtime.url))) return runtime
  }
  throw new Error('本地服务启动超时。请查看数据目录下的 logs/dailywork.log。')
}

export interface OpEnvelope<T = unknown> {
  ok: boolean
  data?: T
  error?: { code: string; message: string; details?: unknown }
  meta: { opId: string; version: number; durationMs?: number }
}

export async function callOp(
  runtime: RuntimeInfo,
  name: string,
  input: Record<string, unknown>,
  actor = 'cli',
): Promise<OpEnvelope> {
  let res: Response
  try {
    res = await fetch(`${runtime.url}/api/ops/${name}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-daily-actor': actor,
        'x-daily-source': actor === 'ai' ? 'ai' : 'cli',
        ...(runtime.token ? { authorization: `Bearer ${runtime.token}` } : {}),
      },
      body: JSON.stringify(input),
    })
  } catch (error) {
    throw new Error(
      `无法连接 ${runtime.url}：${error instanceof Error ? error.message : String(error)}`,
    )
  }
  return (await res.json()) as OpEnvelope
}

export function resolveCliDataDir(flag?: string): string {
  return resolveDataDir(flag ?? process.env.DAILYWORK_DATA_DIR)
}
