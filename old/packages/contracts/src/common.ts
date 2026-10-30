import { z } from 'zod'

export const Id = z.string().min(1).max(64)
export const IsoDateTime = z.string().min(1)

/** Calendar date in the user's local timezone, `YYYY-MM-DD`. */
export const DateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected a YYYY-MM-DD date')

export const TimeOnly = z.string().regex(/^\d{2}:\d{2}$/, 'expected HH:mm')

export const TaskStatus = z.enum(['inbox', 'next', 'doing', 'waiting', 'blocked', 'done'])
export type TaskStatus = z.infer<typeof TaskStatus>

export const TaskPriority = z.enum(['none', 'low', 'medium', 'high', 'urgent'])
export type TaskPriority = z.infer<typeof TaskPriority>

export const ProjectStatus = z.enum(['active', 'paused', 'done', 'archived'])
export type ProjectStatus = z.infer<typeof ProjectStatus>

export const Pagination = z.object({
  limit: z.number().int().min(1).max(500).default(200),
  offset: z.number().int().min(0).default(0),
})
export type Pagination = z.infer<typeof Pagination>

export interface ListResult<T> {
  items: T[]
  total: number
}

export const HexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'expected a #rrggbb color')

export const BaseEntity = {
  id: Id,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
}

export const OpErrorCode = z.enum([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'VERSION_CONFLICT',
  'VALIDATION_ERROR',
  'CONFIRM_REQUIRED',
  'CONFLICT',
  'UNSUPPORTED',
  'AI_DISABLED',
  'UPSTREAM_ERROR',
  'INTERNAL',
])
export type OpErrorCode = z.infer<typeof OpErrorCode>

export interface OpErrorBody {
  code: OpErrorCode
  message: string
  details?: unknown
}

export interface OpEnvelope<T> {
  ok: boolean
  data?: T
  error?: OpErrorBody
  meta: { opId: string; version: number; durationMs?: number }
}

export class OpError extends Error {
  readonly code: OpErrorCode
  readonly details?: unknown
  constructor(code: OpErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'OpError'
    this.code = code
    this.details = details
  }
}

export const Actor = z.enum(['user', 'cli', 'ai', 'system'])
export type Actor = z.infer<typeof Actor>

export const OpAnnotations = z.object({
  readOnly: z.boolean(),
  destructive: z.boolean(),
  idempotent: z.boolean(),
  confirm: z.boolean(),
})
export type OpAnnotations = z.infer<typeof OpAnnotations>

export interface OpDescriptorMeta {
  name: string
  version: number
  kind: 'command' | 'query'
  summary: string
  description?: string
  exposure: { http: boolean; cli: string[] | false; mcp: boolean; ai: boolean }
  annotations: OpAnnotations
  inputSchema: unknown
  errors: string[]
}
