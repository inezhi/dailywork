import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '@daily/platform'
import { saveAttachment, listAttachments, deleteAttachment } from '@daily/attachments'
import { exportBackup, stageImport, applyPendingImport } from '@daily/platform'
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
  dataDir = mkdtempSync(join(tmpdir(), 'dailywork-features-'))
  bundle = createApp({ dataDir, webDist: undefined })
})

afterAll(() => {
  bundle.closeDb()
  rmSync(dataDir, { recursive: true, force: true })
})

describe('attachments', () => {
  it('deduplicates blobs by sha256 and garbage collects at zero refs', async () => {
    const created = await call('task.create', { title: '带附件的任务' })
    const taskId = created.json.data.id
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4])
    const first = saveAttachment(bundle.db, {
      ownerType: 'task',
      ownerId: taskId,
      filename: 'a.png',
      mime: 'image/png',
      data: png,
      thumbData: new Uint8Array([1, 2, 3]),
    })
    const second = saveAttachment(bundle.db, {
      ownerType: 'task',
      ownerId: taskId,
      filename: 'b.png',
      mime: 'image/png',
      data: png,
    })
    expect(first.id).not.toBe(second.id)
    const blobCount = bundle.db.prepare('SELECT COUNT(*) AS c FROM blobs').get() as { c: number }
    expect(blobCount.c).toBe(1)
    expect(listAttachments(bundle.db, 'task', taskId)).toHaveLength(2)
    deleteAttachment(bundle.db, first.id)
    const mid = bundle.db.prepare('SELECT ref_count FROM blobs').get() as { ref_count: number }
    expect(mid.ref_count).toBe(1)
    const byList = await call('attachment.list', { ownerType: 'task', ownerId: taskId })
    expect(byList.json.data).toHaveLength(1)
    deleteAttachment(bundle.db, second.id)
    const end = bundle.db.prepare('SELECT COUNT(*) AS c FROM blobs').get() as { c: number }
    expect(end.c).toBe(0)
  })

  it('rejects unsupported mime types', async () => {
    const created = await call('task.create', { title: '非法附件' })
    expect(() =>
      saveAttachment(bundle.db, {
        ownerType: 'task',
        ownerId: created.json.data.id,
        filename: 'x.svg',
        mime: 'image/svg+xml',
        data: new Uint8Array([1]),
      }),
    ).toThrow(/仅支持/)
  })
})

describe('optimistic concurrency', () => {
  it('rejects stale expectedVersion', async () => {
    const created = await call('task.create', { title: '并发任务' })
    const id = created.json.data.id
    const ok = await call('task.update', { id, title: '改名一', expectedVersion: 1 })
    expect(ok.json.data.version).toBe(2)
    const stale = await call('task.update', { id, title: '改名二', expectedVersion: 1 })
    expect(stale.status).toBe(409)
    expect(stale.json.error.code).toBe('VERSION_CONFLICT')
  })
})

describe('focus', () => {
  it('keeps one running session, records actual minutes and rejects duplicates', async () => {
    const created = await call('task.create', { title: '专注任务' })
    const taskId = created.json.data.id
    const started = await call('focus.start', { taskId, minutes: 25 })
    expect(started.json.ok).toBe(true)
    const duplicate = await call('focus.start', { taskId, minutes: 25 })
    expect(duplicate.status).toBe(409)
    const finished = await call('focus.finish', { id: started.json.data.id, actualSeconds: 120 })
    expect(finished.json.data.status).toBe('completed')
    const task = await call('task.get', { id: taskId })
    expect(task.json.data.actualMinutes).toBe(2)
    const active = await call('focus.active')
    expect(active.json.data).toBeNull()
  })
})

describe('backup round-trip', () => {
  it('exports a .dailywork archive and restores it into a fresh data dir', async () => {
    await call('task.create', { title: '备份里的任务' })
    const exported = exportBackup(bundle.db, dataDir, 'test')
    expect(exported.bytes).toBeGreaterThan(100)
    const target = mkdtempSync(join(tmpdir(), 'dailywork-restore-'))
    try {
      const staged = stageImport(target, exported.path)
      expect(staged.manifest.counts.tasks).toBeGreaterThan(0)
      const applied = applyPendingImport(target)
      expect(applied.applied).toBe(true)
      const restored = openDatabase(join(target, 'data.sqlite'))
      const row = restored
        .prepare("SELECT title FROM tasks WHERE title = '备份里的任务'")
        .get() as { title: string } | undefined
      expect(row?.title).toBe('备份里的任务')
      restored.close()
    } finally {
      rmSync(target, { recursive: true, force: true })
    }
  })
})

describe('AI guardrails', () => {
  let mock: Server
  let baseUrl = ''

  beforeAll(async () => {
    mock = createServer((req, res) => {
      let body = ''
      req.on('data', (chunk) => (body += chunk))
      req.on('end', () => {
        const json = JSON.parse(body || '{}') as { messages?: Array<{ role: string }> }
        const hasToolResult = (json.messages ?? []).some((m) => m.role === 'tool')
        res.setHeader('content-type', 'application/json')
        if (!hasToolResult) {
          res.end(
            JSON.stringify({
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'call_memo',
                        type: 'function',
                        function: {
                          name: 'memo_create',
                          arguments: JSON.stringify({ content: 'AI 想记下的速记' }),
                        },
                      },
                    ],
                  },
                },
              ],
            }),
          )
        } else {
          res.end(
            JSON.stringify({
              choices: [{ message: { role: 'assistant', content: '我先记下来，需要你允许变更。' } }],
            }),
          )
        }
      })
    })
    await new Promise<void>((resolve) => mock.listen(0, '127.0.0.1', () => resolve()))
    const address = mock.address()
    if (address && typeof address === 'object') baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterAll(() => {
    mock.close()
  })

  it('requires confirmation for mutations unless confirmTools is on', async () => {
    const saved = await call('ai.provider.save', {
      name: 'mock',
      baseUrl,
      model: 'mock',
      apiKey: 'test',
      isDefault: true,
    })
    expect(saved.json.ok).toBe(true)
    const denied = await call('ai.chat', { message: '帮我记一下', confirmTools: false })
    expect(denied.json.ok).toBe(true)
    expect(denied.json.data.toolCalls[0].status).toBe('requires_confirmation')
    const before = await call('memo.list', { limit: 10 })
    expect(before.json.data.items.some((m: any) => m.content === 'AI 想记下的速记')).toBe(false)

    const allowed = await call('ai.chat', { message: '帮我记一下', confirmTools: true })
    expect(allowed.json.ok).toBe(true)
    expect(allowed.json.data.toolCalls[0].status).toBe('executed')
    const after = await call('memo.list', { limit: 10 })
    expect(after.json.data.items.some((m: any) => m.content === 'AI 想记下的速记')).toBe(true)
    const logs = bundle.db
      .prepare("SELECT actor, command FROM op_log WHERE command = 'memo.create' ORDER BY id DESC")
      .all() as Array<{ actor: string; command: string }>
    expect(logs[0]?.actor).toBe('ai')
    await call('ai.provider.delete', { id: saved.json.data.id, confirm: true })
  }, 30_000)
})
