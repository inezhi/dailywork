import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { chatCompletionStream } from './index'

let server: Server | null = null

function listen(handler: (res: import('node:http').ServerResponse) => void): Promise<string> {
  return new Promise((resolve) => {
    server = createServer((req, res) => {
      req.resume()
      req.on('end', () => handler(res))
    })
    server.listen(0, '127.0.0.1', () => {
      const address = server!.address()
      if (address && typeof address === 'object') {
        resolve(`http://127.0.0.1:${address.port}`)
      }
    })
  })
}

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()))
    server = null
  }
})

describe('streaming chat completion', () => {
  it('concatenates content deltas and calls onDelta progressively', async () => {
    const baseUrl = await listen((res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.write('data: {"choices":[{"delta":{"content":"你好"}}]}\n\n')
      setTimeout(() => {
        res.write('data: {"choices":[{"delta":{"content":"世界"}}]}\n\n')
        res.end('data: [DONE]\n\n')
      }, 10)
    })
    const deltas: string[] = []
    const result = await chatCompletionStream(
      { baseUrl, model: 'mock', apiKey: 'test' },
      [{ role: 'user', content: 'hi' }],
      [],
      { onDelta: (delta) => { deltas.push(delta) } },
    )
    expect(deltas).toEqual(['你好', '世界'])
    expect(result.content).toBe('你好世界')
    expect(result.toolCalls).toEqual([])
  })

  it('merges fragmented tool call deltas', async () => {
    const baseUrl = await listen((res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.write(
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"today_get","arguments":"{\\"a\\":"}}]}}]}\n\n',
      )
      res.write(
        'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"1}"}}]}}]}\n\n',
      )
      res.end('data: [DONE]\n\n')
    })
    const result = await chatCompletionStream(
      { baseUrl, model: 'mock', apiKey: 'test' },
      [{ role: 'user', content: 'hi' }],
      [],
    )
    expect(result.content).toBeNull()
    expect(result.toolCalls).toEqual([
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'today_get', arguments: '{"a":1}' },
      },
    ])
  })

  it('raises a stable error for HTTP failures', async () => {
    const baseUrl = await listen((res) => {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end('{"error":"boom"}')
    })
    await expect(
      chatCompletionStream(
        { baseUrl, model: 'mock', apiKey: 'test' },
        [{ role: 'user', content: 'hi' }],
        [],
      ),
    ).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' })
  })
})
