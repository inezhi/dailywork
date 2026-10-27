import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from './app.js'

let dataDir: string
let bundle: ReturnType<typeof createApp>

async function request(
  path: string,
  init: RequestInit & { cookie?: string } = {},
): Promise<{ status: number; json: any; cookie: string | null; res: Response }> {
  const headers = new Headers(init.headers)
  if (init.cookie) headers.set('cookie', init.cookie)
  const res = await bundle.app.request(path, { ...init, headers })
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
    cookie: res.headers.get('set-cookie')?.split(';')[0] ?? null,
    res,
  }
}

async function cookieFor(username: string, password: string): Promise<string> {
  const res = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  expect(res.status).toBe(200)
  return res.cookie!
}

beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'dailywork-auth-'))
  bundle = createApp({ dataDir, webDist: undefined, token: 'owner-token' })
})

afterAll(() => {
  bundle.closeDb()
  rmSync(dataDir, { recursive: true, force: true })
})

describe('local accounts', () => {
  it('reports no users, registers the owner and accepts a session', async () => {
    const status = await request('/api/auth/status')
    expect(status.json.data.hasUsers).toBe(false)
    const registered = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'Owner', password: 'secret123' }),
    })
    expect(registered.status).toBe(200)
    expect(registered.json.data.user.username).toBe('Owner')
    expect(registered.cookie).toMatch(/^daily_session=/)
    const me = await request('/api/auth/me', { cookie: registered.cookie! })
    expect(me.status).toBe(200)
    expect(me.json.data.user.username).toBe('Owner')
    expect(me.json.data.user.avatarUrl).toBeNull()
  })

  it('isolates data per account', async () => {
    const owner = await cookieFor('Owner', 'secret123')
    const created = await request('/api/ops/task.create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cookie: owner,
      body: JSON.stringify({ title: 'Owner 的任务' }),
    })
    expect(created.json.ok).toBe(true)
    const second = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'Second', password: 'secret456' }),
    })
    expect(second.status).toBe(200)
    const secondTasks = await request('/api/ops/task.list', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cookie: second.cookie!,
      body: '{}',
    })
    expect(secondTasks.json.data.total).toBe(0)
    const ownerTasks = await request('/api/ops/task.list', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cookie: owner,
      body: '{}',
    })
    expect(ownerTasks.json.data.total).toBe(1)
  })

  it('rejects unauthenticated operations once accounts exist', async () => {
    const denied = await request('/api/ops/task.list', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    expect(denied.status).toBe(401)
    expect(denied.json.error.code).toBe('UNAUTHORIZED')
  })

  it('supports owner CLI access through the runtime token', async () => {
    const owner = await cookieFor('Owner', 'secret123')
    const viaOwner = await request('/api/ops/today.get', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer owner-token' },
      body: JSON.stringify({}),
    })
    expect(viaOwner.json.ok).toBe(true)
    expect(viaOwner.json.data.scheduled).toBeDefined()
    expect(owner).toMatch(/^daily_session=/)
  })

  it('changes the password and invalidates other sessions', async () => {
    const current = await cookieFor('Owner', 'secret123')
    const other = await cookieFor('Owner', 'secret123')
    expect(other).not.toBe(current)
    const changed = await request('/api/auth/password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cookie: current,
      body: JSON.stringify({ currentPassword: 'secret123', newPassword: 'newsecret123' }),
    })
    expect(changed.status).toBe(200)
    const invalidated = await request('/api/auth/me', { cookie: other })
    expect(invalidated.status).toBe(401)
    const oldLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'Owner', password: 'secret123' }),
    })
    expect(oldLogin.status).toBe(401)
    const newLogin = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'Owner', password: 'newsecret123' }),
    })
    expect(newLogin.status).toBe(200)
  })

  it('uploads and serves an avatar, and rejects unsupported files', async () => {
    const cookie = await cookieFor('Owner', 'newsecret123')
    const form = new FormData()
    form.append('file', new File([new Uint8Array([137, 80, 78, 71])], 'avatar.png', { type: 'image/png' }))
    const uploaded = await request('/api/auth/avatar', {
      method: 'POST',
      cookie,
      body: form,
    })
    expect(uploaded.status).toBe(200)
    const avatarUrl = uploaded.json.data.user.avatarUrl as string
    expect(avatarUrl).toContain('/api/auth/avatar/')
    const image = await request(avatarUrl, { cookie })
    expect(image.status).toBe(200)
    expect(image.res.headers.get('content-type')).toBe('image/png')

    const bad = new FormData()
    bad.append('file', new File([new Uint8Array([1, 2])], 'x.svg', { type: 'image/svg+xml' }))
    const rejected = await request('/api/auth/avatar', { method: 'POST', cookie, body: bad })
    expect(rejected.status).toBe(400)
  })
})

describe('per-account backup staging', () => {
  it('exports only the current account and stages imports in that account folder', async () => {
    const cookie = await cookieFor('Owner', 'newsecret123')
    const created = await request('/api/ops/task.create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cookie,
      body: JSON.stringify({ title: '备份账户任务' }),
    })
    expect(created.json.ok).toBe(true)
    const exported = await request('/api/ops/backup.export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cookie,
      body: '{}',
    })
    expect(exported.json.ok).toBe(true)
    const path = exported.json.data.path as string
    const imported = await request('/api/ops/backup.import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cookie,
      body: JSON.stringify({ sourcePath: path, confirm: true }),
    })
    expect(imported.json.ok).toBe(true)
    expect(imported.json.data.restartRequired).toBe(true)
    const me = await request('/api/auth/me', { cookie })
    const pending = join(dataDir, 'users', me.json.data.user.id, 'data.sqlite.import-pending')
    expect(existsSync(pending)).toBe(true)
  })
})
