import { createInterface } from 'node:readline'
import type { OpDescriptorMeta } from '@daily/contracts'
import { listOpsMeta } from '@daily/ops'
import { callOp, ensureServer, resolveCliDataDir } from './client.js'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: number | string | null
  method: string
  params?: Record<string, unknown>
}

function toolName(opName: string): string {
  return opName.replaceAll('.', '_')
}

export async function serveMcp(dataDirFlag?: string): Promise<void> {
  const dataDir = resolveCliDataDir(dataDirFlag)
  const metas = listOpsMeta().filter((op) => op.exposure.mcp)
  const byTool = new Map(metas.map((op) => [toolName(op.name), op]))
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })
  const send = (payload: unknown) => {
    process.stdout.write(JSON.stringify(payload) + '\n')
  }
  const reply = (id: JsonRpcRequest['id'], result: unknown) =>
    send({ jsonrpc: '2.0', id: id ?? null, result })
  const fail = (id: JsonRpcRequest['id'], code: number, message: string) =>
    send({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

  process.stderr.write(`[daily mcp] ready with ${metas.length} tools\n`)

  for await (const line of rl) {
    if (!line.trim()) continue
    let request: JsonRpcRequest
    try {
      request = JSON.parse(line) as JsonRpcRequest
    } catch {
      process.stderr.write('[daily mcp] invalid json\n')
      continue
    }
    if (request.id === undefined || request.method.startsWith('notifications/')) {
      continue
    }
    try {
      switch (request.method) {
        case 'initialize':
          reply(request.id, {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'dailywork', version: '0.1.0' },
          })
          break
        case 'ping':
          reply(request.id, {})
          break
        case 'tools/list':
          reply(request.id, {
            tools: metas.map((op) => toTool(op)),
          })
          break
        case 'tools/call': {
          const name = String(request.params?.name ?? '')
          const op = byTool.get(name)
          if (!op) {
            fail(request.id, -32602, `未知工具：${name}`)
            break
          }
          const args = (request.params?.arguments ?? {}) as Record<string, unknown>
          const runtime = await ensureServer(dataDir)
          const envelope = await callOp(runtime, op.name, args, 'ai')
          reply(request.id, {
            content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }],
            isError: !envelope.ok,
          })
          break
        }
        default:
          fail(request.id, -32601, `不支持的方法：${request.method}`)
      }
    } catch (error) {
      fail(request.id, -32603, error instanceof Error ? error.message : String(error))
    }
  }
}

function toTool(op: OpDescriptorMeta) {
  const schema = op.inputSchema as {
    type?: string
    properties?: Record<string, unknown>
    required?: string[]
  }
  const inputSchema: Record<string, unknown> = {
    type: 'object',
    properties: { ...(schema.properties ?? {}) },
    required: schema.required ?? [],
  }
  if (op.annotations.confirm) {
    ;(inputSchema.properties as Record<string, unknown>).confirm = {
      type: 'boolean',
      description: '确认执行破坏性操作。请先向用户说明影响并征得同意。',
    }
  }
  return {
    name: toolName(op.name),
    title: op.summary,
    description: `${op.summary}（操作名：${op.name}）`,
    inputSchema,
    annotations: {
      readOnlyHint: op.annotations.readOnly,
      destructiveHint: op.annotations.destructive,
      idempotentHint: op.annotations.idempotent,
      openWorldHint: false,
    },
  }
}
