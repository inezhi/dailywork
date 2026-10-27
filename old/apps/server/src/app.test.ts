import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from './app.js'

let dataDir: string
let bundle: ReturnType<typeof createApp>

async function call(name: string, body: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  const res = await bundle.app.request(`/api/ops/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  return { status: res.status, json: (await res.json()) as any }
}

beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'dailywork-test-'))
  bundle = createApp({ dataDir, webDist: undefined })
})

afterAll(() => {
  bundle.closeDb()
  rmSync(dataDir, { recursive: true, force: true })
})

describe('ops api', () => {
  it('creates and lists tasks', async () => {
    const created = await call('task.create', { title: '写 M0a 验收测试', priority: 'high' })
    expect(created.status).toBe(200)
    expect(created.json.ok).toBe(true)
    expect(created.json.data.title).toBe('写 M0a 验收测试')

    const list = await call('task.list', { limit: 10 })
    expect(list.json.data.total).toBe(1)
    expect(list.json.data.items[0].priority).toBe('high')
  })

  it('is idempotent with the same opId', async () => {
    const opId = 'op_test_idempotent_1'
    const first = await call('task.create', { title: '只应创建一次', opId })
    const second = await call('task.create', { title: '只应创建一次', opId })
    expect(second.json.data.id).toBe(first.json.data.id)
    const list = await call('task.list', { search: '只应创建一次' })
    expect(list.json.data.total).toBe(1)
  })

  it('rejects invalid input with a stable error code', async () => {
    const res = await call('task.create', { title: '' })
    expect(res.status).toBe(422)
    expect(res.json.error.code).toBe('VALIDATION_ERROR')
  })

  it('requires confirmation for destructive operations', async () => {
    const created = await call('task.create', { title: '待删除' })
    const denied = await call('task.delete', { id: created.json.data.id })
    expect(denied.status).toBe(428)
    expect(denied.json.error.code).toBe('CONFIRM_REQUIRED')
    const ok = await call('task.delete', { id: created.json.data.id, confirm: true })
    expect(ok.json.ok).toBe(true)
  })

  it('completes a task and records an audit entry', async () => {
    const created = await call('task.create', { title: '完成任务' })
    const completed = await call('task.complete', { id: created.json.data.id })
    expect(completed.json.data.status).toBe('done')
    const rows = bundle.db.prepare('SELECT command FROM op_log ORDER BY id').all() as Array<{
      command: string
    }>
    expect(rows.map((r) => r.command)).toContain('task.complete')
  })

  it('serves today and dashboard read models', async () => {
    await call('task.create', { title: '今天的事', scheduledDate: '2026-10-27' })
    const today = await call('today.get', { date: '2026-10-27' })
    expect(today.json.ok).toBe(true)
    expect(today.json.data.date).toBe('2026-10-27')
    expect(Array.isArray(today.json.data.scheduled)).toBe(true)
    const dash = await call('analytics.dashboard', { range: '30d' })
    expect(dash.json.ok).toBe(true)
    expect(dash.json.data.trend.length).toBe(30)
  })
})
