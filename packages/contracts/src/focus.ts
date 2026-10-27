import { z } from 'zod'
import { DateOnly, Id, IsoDateTime, Pagination } from './common.js'

export const FocusSessionSchema = z.object({
  id: Id,
  taskId: Id.nullable(),
  taskTitle: z.string().nullable().optional(),
  mode: z.enum(['focus', 'break']),
  plannedMinutes: z.number().int(),
  startedAt: IsoDateTime,
  endedAt: IsoDateTime.nullable(),
  actualSeconds: z.number().int(),
  status: z.enum(['running', 'completed', 'cancelled']),
  note: z.string(),
})
export type FocusSession = z.infer<typeof FocusSessionSchema>

export const StartFocusInput = z.object({
  taskId: Id.nullish(),
  minutes: z.number().int().min(1).max(180).default(25),
  mode: z.enum(['focus', 'break']).optional(),
})
export type StartFocusInput = z.infer<typeof StartFocusInput>

export const FinishFocusInput = z.object({
  id: Id,
  actualSeconds: z.number().int().min(0).max(12 * 60 * 60).optional(),
  outcome: z.enum(['completed', 'cancelled']).optional(),
  note: z.string().max(1000).optional(),
})
export type FinishFocusInput = z.infer<typeof FinishFocusInput>

export const ListFocusInput = Pagination.extend({
  from: DateOnly.optional(),
  to: DateOnly.optional(),
  taskId: Id.optional(),
})
export type ListFocusInput = z.infer<typeof ListFocusInput>

export const FocusStats = z.object({
  todayMinutes: z.number().int(),
  todaySessions: z.number().int(),
  weekMinutes: z.number().int(),
  streakDays: z.number().int(),
  byTask: z.array(z.object({ taskId: Id.nullable(), title: z.string(), minutes: z.number().int() })),
})
export type FocusStats = z.infer<typeof FocusStats>

export const FocusRefInput = z.object({ id: Id })
