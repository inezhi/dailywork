import type { OpEnvelope } from '@daily/contracts'

export class ApiError extends Error {
  code: string
  details?: unknown
  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }
}

export async function callOp<T>(name: string, input: unknown = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/ops/${name}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-daily-actor': 'user',
        'x-daily-source': 'gui',
      },
      body: JSON.stringify(input),
    })
  } catch (error) {
    throw new ApiError(
      'NETWORK',
      error instanceof Error ? error.message : '无法连接本地服务，请确认服务正在运行',
    )
  }
  let envelope: OpEnvelope<T>
  try {
    envelope = (await res.json()) as OpEnvelope<T>
  } catch {
    throw new ApiError('BAD_RESPONSE', `服务返回了无法解析的响应（HTTP ${res.status}）`)
  }
  if (!envelope.ok || envelope.error) {
    throw new ApiError(
      envelope.error?.code ?? 'INTERNAL',
      envelope.error?.message ?? `请求失败（HTTP ${res.status}）`,
      envelope.error?.details,
    )
  }
  return envelope.data as T
}

export async function uploadAttachment(ownerType: string, ownerId: string, file: File, thumb?: Blob | null) {
  const form = new FormData()
  form.append('ownerType', ownerType)
  form.append('ownerId', ownerId)
  form.append('file', file)
  if (thumb) form.append('thumb', thumb, 'thumb.webp')
  const res = await fetch('/api/attachments', { method: 'POST', body: form })
  const data = (await res.json()) as {
    ok: boolean
    data?: unknown
    error?: { message: string }
  }
  if (!data.ok) throw new ApiError('UPLOAD_FAILED', data.error?.message ?? '上传失败')
  return data.data
}

export function attachmentUrl(id: string, thumb = false): string {
  return `/api/attachments/${id}/${thumb ? 'thumb' : 'content'}`
}


export interface AssistantStreamEvent {
  type: 'start' | 'delta' | 'tool_start' | 'tool_result' | 'done' | 'error'
  conversationId?: string
  text?: string
  name?: string
  input?: unknown
  result?: unknown
  status?: 'executed' | 'requires_confirmation' | 'failed'
  message?: string
}

export async function streamAiChat(
  input: unknown,
  onEvent: (event: AssistantStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/ai/chat/stream', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-daily-actor': 'user',
      'x-daily-source': 'gui',
    },
    body: JSON.stringify(input),
    signal,
  })
  if (!res.ok) {
    let message = `AI 请求失败（HTTP ${res.status}）`
    try {
      const body = (await res.json()) as { error?: { message?: string } }
      if (body.error?.message) message = body.error.message
    } catch {
      // keep status message
    }
    throw new ApiError('AI_STREAM_FAILED', message)
  }
  if (!res.body) throw new ApiError('AI_STREAM_FAILED', 'AI 没有返回流式响应')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const dispatch = (block: string) => {
    let data = ''
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    if (!data) return
    try {
      onEvent(JSON.parse(data) as AssistantStreamEvent)
    } catch {
      // ignore malformed events
    }
  }
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let match = buffer.match(/\r?\n\r?\n/)
    while (match && match.index !== undefined) {
      const block = buffer.slice(0, match.index)
      buffer = buffer.slice(match.index + match[0].length)
      dispatch(block)
      match = buffer.match(/\r?\n\r?\n/)
    }
  }
  if (buffer.trim()) dispatch(buffer)
}
