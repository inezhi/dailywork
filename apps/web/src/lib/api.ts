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
