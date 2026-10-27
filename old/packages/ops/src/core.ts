import { z } from 'zod'
import {
  OpError,
  type Actor,
  type OpDescriptorMeta,
  type OpEnvelope,
  type OpErrorCode,
} from '@daily/contracts'
import { findOpLog, newOpId, recordOp, type Db } from '@daily/platform'

export interface OpContext {
  db: Db
  dataDir: string
  actor: Actor
  source: string
  version: string
  port?: number
  httpsPort?: number
  pairingCode?: string
  userId?: string
}

export interface OpDefinition<S extends z.ZodTypeAny = z.ZodTypeAny, R = unknown> {
  name: string
  version: number
  kind: 'command' | 'query'
  summary: string
  description?: string
  input: S
  exposure: { http: boolean; cli: string[] | false; mcp: boolean; ai: boolean }
  annotations?: Partial<{
    readOnly: boolean
    destructive: boolean
    idempotent: boolean
    confirm: boolean
  }>
  errors?: string[]
  aggregate?: 'task' | 'project' | 'space' | 'memo' | 'document' | 'focus' | 'settings' | 'system' | 'ai'
  handler: (ctx: OpContext & { opId: string }, input: z.infer<S>) => Promise<R> | R
}

export type AnyOpDefinition = OpDefinition<z.ZodTypeAny, unknown>

export function defineOp<S extends z.ZodTypeAny, R>(def: OpDefinition<S, R>): OpDefinition<S, R> {
  return def
}

export function opMeta(def: AnyOpDefinition): OpDescriptorMeta {
  const readOnly = def.kind === 'query'
  return {
    name: def.name,
    version: def.version,
    kind: def.kind,
    summary: def.summary,
    description: def.description,
    exposure: def.exposure,
    annotations: {
      readOnly,
      destructive: def.annotations?.destructive ?? false,
      idempotent: def.annotations?.idempotent ?? readOnly,
      confirm: def.annotations?.confirm ?? false,
    },
    inputSchema: zodToJsonSchema(def.input),
    errors: def.errors ?? [],
  }
}

function zodToJsonSchema(schema: z.ZodTypeAny): unknown {
  try {
    return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })
  } catch {
    return { type: 'object' }
  }
}

export interface OpRunResult {
  envelope: OpEnvelope<unknown>
  status: number
}

const STATUS_BY_CODE: Record<OpErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  CONFLICT: 409,
  CONFIRM_REQUIRED: 428,
  UNSUPPORTED: 501,
  AI_DISABLED: 503,
  UPSTREAM_ERROR: 502,
  INTERNAL: 500,
}

export async function runOp(
  def: AnyOpDefinition,
  ctx: OpContext,
  rawInput: unknown,
): Promise<OpRunResult> {
  const started = Date.now()
  const raw =
    rawInput && typeof rawInput === 'object'
      ? (rawInput as Record<string, unknown>)
      : {}
  const opId = typeof raw.opId === 'string' && raw.opId.length > 0 ? raw.opId : newOpId()

  if (def.kind === 'command' && typeof raw.opId === 'string') {
    const record = findOpLog(ctx.db, opId)
    if (record && record.command === def.name) {
      let data: unknown = { id: record.aggregateId }
      if (record.afterJson) {
        try {
          data = JSON.parse(record.afterJson)
        } catch {
          // keep the id fallback
        }
      }
      return {
        envelope: {
          ok: true,
          data,
          meta: { opId, version: def.version, durationMs: Date.now() - started },
        },
        status: 200,
      }
    }
  }

  const parsed = def.input.safeParse({ ...raw, ...(def.kind === 'command' ? { opId } : {}) })
  if (!parsed.success) {
    return errorResult(
      'VALIDATION_ERROR',
      '输入参数校验失败',
      parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      })),
      opId,
      def.version,
      started,
    )
  }

  try {
    const data = await def.handler({ ...ctx, opId }, parsed.data as z.infer<typeof def.input>)
    if (def.kind === 'command' && !findOpLog(ctx.db, opId)) {
      const obj = data as Record<string, unknown> | null
      const parsedObj = parsed.data as Record<string, unknown>
      const aggregateId =
        (obj && typeof obj.id === 'string' ? obj.id : undefined) ??
        (typeof parsedObj.id === 'string' ? parsedObj.id : '')
      recordOp(ctx.db, {
        opId,
        ts: new Date().toISOString(),
        actor: ctx.actor,
        source: ctx.source,
        command: def.name,
        aggregateType: def.aggregate ?? 'system',
        aggregateId,
        summary: def.summary,
        payload: parsed.data,
        after: data,
      })
    }
    return {
      envelope: {
        ok: true,
        data,
        meta: { opId, version: def.version, durationMs: Date.now() - started },
      },
      status: 200,
    }
  } catch (err) {
    if (err instanceof OpError) {
      return errorResult(err.code, err.message, err.details, opId, def.version, started)
    }
    if (err instanceof z.ZodError) {
      return errorResult(
        'VALIDATION_ERROR',
        '输入参数校验失败',
        err.issues,
        opId,
        def.version,
        started,
      )
    }
    const message = err instanceof Error ? err.message : String(err)
    if (process.env.NODE_ENV !== 'test') {
      console.error(`[op:${def.name}]`, err)
    }
    return errorResult('INTERNAL', message, undefined, opId, def.version, started)
  }
}

function errorResult(
  code: OpErrorCode,
  message: string,
  details: unknown,
  opId: string,
  version: number,
  started: number,
): OpRunResult {
  return {
    envelope: {
      ok: false,
      error: { code, message, details },
      meta: { opId, version, durationMs: Date.now() - started },
    },
    status: STATUS_BY_CODE[code] ?? 500,
  }
}
