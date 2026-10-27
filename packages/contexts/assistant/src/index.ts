import {
  OpError,
  type Provider,
  type SaveProviderInput,
  type TestProviderResult,
} from '@daily/contracts'
import { decryptSecret, encryptSecret, newId, nowIso, type Db } from '@daily/platform'

interface ProviderRow {
  id: string
  name: string
  base_url: string
  model: string
  api_key_encrypted: string | null
  is_default: number
  created_at: string
  updated_at: string
}

function mapProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    model: row.model,
    hasKey: Boolean(row.api_key_encrypted),
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listProviders(db: Db): Provider[] {
  const rows = db
    .prepare('SELECT * FROM ai_providers ORDER BY is_default DESC, created_at')
    .all() as unknown as ProviderRow[]
  return rows.map(mapProvider)
}

export function getProviderRow(db: Db, id: string): ProviderRow {
  const row = db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(id) as ProviderRow | undefined
  if (!row) throw new OpError('NOT_FOUND', 'AI 供应商不存在')
  return row
}

export function saveProvider(db: Db, input: SaveProviderInput, dataDir: string): Provider {
  const at = nowIso()
  const existing = input.id ? (getProviderRow(db, input.id) as ProviderRow | null) : null
  const id = input.id ?? newId('prv')
  const encrypted =
    input.apiKey && input.apiKey.trim()
      ? encryptSecret(dataDir, input.apiKey.trim())
      : (existing?.api_key_encrypted ?? null)
  if (existing) {
    db.prepare(
      `UPDATE ai_providers SET name = ?, base_url = ?, model = ?, api_key_encrypted = ?,
        is_default = ?, updated_at = ? WHERE id = ?`,
    ).run(
      input.name.trim(),
      input.baseUrl.replace(/\/+$/, ''),
      input.model.trim(),
      encrypted,
      input.isDefault ? 1 : existing.is_default,
      at,
      id,
    )
  } else {
    db.prepare(
      `INSERT INTO ai_providers(id, name, base_url, model, api_key_encrypted, is_default, created_at, updated_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.name.trim(),
      input.baseUrl.replace(/\/+$/, ''),
      input.model.trim(),
      encrypted,
      input.isDefault ? 1 : 0,
      at,
      at,
    )
  }
  if (input.isDefault) {
    db.prepare('UPDATE ai_providers SET is_default = 0 WHERE id != ?').run(id)
  } else if (!existing) {
    const count = db.prepare('SELECT COUNT(*) AS c FROM ai_providers WHERE is_default = 1').get() as {
      c: number
    }
    if (count.c === 0) db.prepare('UPDATE ai_providers SET is_default = 1 WHERE id = ?').run(id)
  }
  return mapProvider(getProviderRow(db, id))
}

export function deleteProvider(db: Db, id: string): { id: string } {
  db.prepare('DELETE FROM ai_providers WHERE id = ?').run(id)
  return { id }
}

export function defaultProvider(db: Db): { row: ProviderRow; apiKey: string } | null {
  const row = db
    .prepare('SELECT * FROM ai_providers WHERE is_default = 1 ORDER BY created_at LIMIT 1')
    .get() as ProviderRow | undefined
  if (!row) return null
  return { row, apiKey: '' }
}

export async function testProvider(
  db: Db,
  dataDir: string,
  id?: string,
): Promise<TestProviderResult> {
  const row = id
    ? getProviderRow(db, id)
    : (db.prepare('SELECT * FROM ai_providers WHERE is_default = 1').get() as ProviderRow | undefined)
  if (!row) return { ok: false, message: '还没有配置 AI 供应商' }
  const key = decryptSecret(dataDir, row.api_key_encrypted)
  if (!key) return { ok: false, message: '缺少 API Key' }
  const started = Date.now()
  try {
    const res = await fetch(`${row.base_url.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: row.model,
        messages: [{ role: 'user', content: '回复"ok"两个字符。' }],
        max_tokens: 8,
        stream: false,
      }),
      signal: AbortSignal.timeout(20_000),
    })
    const latencyMs = Date.now() - started
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, message: `HTTP ${res.status}: ${text.slice(0, 200)}`, latencyMs }
    }
    return { ok: true, message: '连接成功', latencyMs, model: row.model }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - started,
    }
  }
}

export function resolveProvider(
  db: Db,
  dataDir: string,
): { baseUrl: string; model: string; apiKey: string; name: string } {
  const row = db
    .prepare('SELECT * FROM ai_providers WHERE is_default = 1 ORDER BY created_at LIMIT 1')
    .get() as ProviderRow | undefined
  if (!row) throw new OpError('AI_DISABLED', '还没有配置 AI 供应商')
  const apiKey = decryptSecret(dataDir, row.api_key_encrypted)
  if (!apiKey) throw new OpError('AI_DISABLED', 'AI 供应商缺少 API Key')
  return {
    baseUrl: row.base_url.replace(/\/+$/, ''),
    model: row.model,
    apiKey,
    name: row.name,
  }
}

// ---------- conversations ----------

export interface ConversationRow {
  id: string
  title: string
  context_kind: string
  context_id: string | null
  created_at: string
  updated_at: string
}

export interface MessageRow {
  id: string
  conversation_id: string
  role: string
  content: string
  tool_name: string | null
  created_at: string
}

export function createConversation(
  db: Db,
  input: { title?: string; contextKind?: string; contextId?: string | null } = {},
): ConversationRow {
  const at = nowIso()
  const id = newId('cnv')
  db.prepare(
    `INSERT INTO ai_conversations(id, title, context_kind, context_id, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.title?.slice(0, 80) || '新对话',
    input.contextKind ?? 'global',
    input.contextId ?? null,
    at,
    at,
  )
  return db.prepare('SELECT * FROM ai_conversations WHERE id = ?').get(id) as unknown as ConversationRow
}

export function getConversation(db: Db, id: string): ConversationRow {
  const row = db.prepare('SELECT * FROM ai_conversations WHERE id = ?').get(id) as
    | ConversationRow
    | undefined
  if (!row) throw new OpError('NOT_FOUND', '对话不存在')
  return row
}

export function listConversations(db: Db, limit = 30): ConversationRow[] {
  return db
    .prepare('SELECT * FROM ai_conversations ORDER BY updated_at DESC LIMIT ?')
    .all(limit) as unknown as ConversationRow[]
}

export function listMessages(db: Db, conversationId: string, limit = 40): MessageRow[] {
  const rows = db
    .prepare(
      `SELECT * FROM ai_messages WHERE conversation_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(conversationId, limit) as unknown as MessageRow[]
  return rows.reverse()
}

export function addMessage(
  db: Db,
  input: { conversationId: string; role: string; content: string; toolName?: string | null },
): MessageRow {
  const at = nowIso()
  const id = newId('msg')
  db.prepare(
    `INSERT INTO ai_messages(id, conversation_id, role, content, tool_name, created_at)
     VALUES(?, ?, ?, ?, ?, ?)`,
  ).run(id, input.conversationId, input.role, input.content, input.toolName ?? null, at)
  db.prepare('UPDATE ai_conversations SET updated_at = ? WHERE id = ?').run(at, input.conversationId)
  return {
    id,
    conversation_id: input.conversationId,
    role: input.role,
    content: input.content,
    tool_name: input.toolName ?? null,
    created_at: at,
  }
}

export function renameConversation(db: Db, id: string, title: string): void {
  db.prepare('UPDATE ai_conversations SET title = ?, updated_at = ? WHERE id = ?').run(
    title.slice(0, 80),
    nowIso(),
    id,
  )
}

// ---------- OpenAI-compatible chat ----------

export interface ChatTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: unknown
  }
}

export type LlmMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: LlmToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string }

export interface LlmToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface ChatCompletionResult {
  content: string | null
  toolCalls: LlmToolCall[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

export async function chatCompletion(
  provider: { baseUrl: string; model: string; apiKey: string },
  messages: LlmMessage[],
  tools: ChatTool[],
  options: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
): Promise<ChatCompletionResult> {
  const body: Record<string, unknown> = {
    model: provider.model,
    messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 2000,
    stream: false,
  }
  if (tools.length > 0) {
    body.tools = tools
    body.tool_choice = 'auto'
  }
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify(body),
    signal: options.signal ?? AbortSignal.timeout(90_000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new OpError('UPSTREAM_ERROR', `模型请求失败（HTTP ${res.status}）：${text.slice(0, 300)}`)
  }
  const json = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null
        tool_calls?: LlmToolCall[]
      }
    }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  const message = json.choices?.[0]?.message
  if (!message) throw new OpError('UPSTREAM_ERROR', '模型返回为空')
  return {
    content: message.content ?? null,
    toolCalls: message.tool_calls ?? [],
    usage: json.usage,
  }
}

export function providerInfo(db: Db): {
  baseUrl: string
  model: string
  name: string
  hasKey: boolean
} | null {
  const row = db
    .prepare('SELECT * FROM ai_providers WHERE is_default = 1 ORDER BY created_at LIMIT 1')
    .get() as ProviderRow | undefined
  if (!row) return null
  return {
    baseUrl: row.base_url,
    model: row.model,
    name: row.name,
    hasKey: Boolean(row.api_key_encrypted),
  }
}
