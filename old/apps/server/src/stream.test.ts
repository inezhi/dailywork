import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from './app.js'

let dataDir: string
let bundle: ReturnType<typeof createApp>
let mock: Server
let baseUrl = ''

async function call(name: string, body: Record<string, unknown> = {}) {
  const res = await bundle.app.request(`/api/ops/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, json: (await res.json()) as any }
}

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'dailywork-stream-'))
  bundle = createApp({ dataDir, webDist: undefined })
  mock = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      const json = JSON.parse(body || '{}') as { messages?: Array<{ role: string }> }
      const hasTool = (json.messages ?? []).some((message) => message.role === 'tool')
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      if (!hasTool) {
        res.write(
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_today","type":"function","function":{"name":"today_get","arguments":"{}"}}]}}]}\n\n',
        )
        res.end('data: [DONE]\n\n')
      } else {
        res.write('data: {"choices":[{"delta":{"content":"今天"}}]}\n\n')
        res.write('data: {"choices":[{"delta":{"content":"有 0 项。"}}]}\n\n')
        res.end('data: [DONE]\n\n')
      }
    })
  })
  await new Promise<void>((resolve) => mock.listen(0, '127.0.0.1', () => resolve()))
  const address = mock.address()
  if (address && typeof address === 'object') baseUrl = `http://127.0.0.1:${address.port}`
  await call('ai.provider.save', {
    name: 'mock-stream',
    baseUrl,
    model: 'mock-stream',
    apiKey: 'test',
    isDefault: true,
  })
})

afterAll(() => {
  mock.close()
  bundle.closeDb()
  rmSync(dataDir, { recursive: true, force: true })
})

describe('streaming AI route', () => {
  it('emits start, tool events, deltas and a done envelope', async () => {
    const res = await bundle.app.request('/api/ai/chat/stream', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '今天怎么样？', confirmTools: false }),
    })
    expect(res.status).toBe(200)
    const text = await res.text()
    const events = text
      .split(/\n\n/)
      .map((block) => {
        const event = block.match(/^event: (.*)$/m)?.[1]
        const data = block.match(/^data: (.*)$/m)?.[1]
        return event && data ? { event, data: JSON.parse(data) } : null
      })
      .filter(Boolean) as Array<{ event: string; data: any }>
    expect(events.map((entry) => entry.event)).toContain('start')
    expect(events.map((entry) => entry.event)).toContain('tool_start')
    expect(events.map((entry) => entry.event)).toContain('tool_result')
    expect(events.filter((entry) => entry.event === 'delta').length).toBeGreaterThan(0)
    const done = events.find((entry) => entry.event === 'done')
    expect(done?.data.result.message.content).toBe('今天有 0 项。')
    expect(done?.data.result.conversationId).toMatch(/^cnv_/)
  })
})
