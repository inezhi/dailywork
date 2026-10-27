import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from './app.js'

let dataDir: string
let bundle: ReturnType<typeof createApp>

const remoteEnv = {
  incoming: { socket: { remoteAddress: '203.0.113.10' } },
}

async function request(path: string, init: RequestInit & { cookie?: string } = {}) {
  const headers = new Headers(init.headers)
  if (init.cookie) headers.set('cookie', init.cookie)
  const res = await bundle.app.request(
    path,
    { ...init, headers },
    remoteEnv as never,
  )
  const text = await res.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text }
  }
  return {
    status: res.status,
    json,
    cookie: res.headers.get('set-cookie'),
    res,
  }
}

beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'dailywork-server-mode-'))
  bundle = createApp({
    dataDir,
    token: 'owner-token',
    serverMode: true,
    openRegistration: false,
    secureCookies: true,
  })
})

afterAll(() => {
  bundle.closeDb()
  rmSync(dataDir, { recursive: true, force: true })
})

describe('server deployment mode', () => {
  it('allows the first remote registration and sets a secure session', async () => {
    const registered = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ServerOwner', password: 'secret123' }),
    })
    expect(registered.status).toBe(200)
    expect(registered.json.data.user.username).toBe('ServerOwner')
    expect(registered.cookie).toContain('daily_session=')
    expect(registered.cookie?.toLowerCase()).toContain('secure')
    expect(registered.cookie?.toLowerCase()).toContain('httponly')
  })

  it('allows authenticated remote operations without enabling LAN pairing', async () => {
    const login = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ServerOwner', password: 'secret123' }),
    })
    expect(login.status).toBe(200)
    const cookie = login.cookie?.split(';')[0]
    expect(cookie).toBeTruthy()
    const created = await request('/api/ops/task.create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cookie,
      body: JSON.stringify({ title: 'Docker 部署验收任务' }),
    })
    expect(created.status).toBe(200)
    expect(created.json.ok).toBe(true)
  })

  it('closes public registration after the first account by default', async () => {
    const second = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'SecondOwner', password: 'secret456' }),
    })
    expect(second.status).toBe(403)
    expect(second.json.error.code).toBe('UNAUTHORIZED')
  })

  it('still blocks remote registration outside server mode', async () => {
    const normalDir = mkdtempSync(join(tmpdir(), 'dailywork-normal-mode-'))
    const normal = createApp({ dataDir: normalDir, token: 'owner-token' })
    try {
      const res = await normal.app.request(
        '/api/auth/register',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username: 'RemoteUser', password: 'secret789' }),
        },
        remoteEnv as never,
      )
      expect(res.status).toBe(403)
    } finally {
      normal.closeDb()
      rmSync(normalDir, { recursive: true, force: true })
    }
  })
})
