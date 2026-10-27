import { z } from 'zod'
import { DateOnly, Id, IsoDateTime, Pagination, HexColor } from './common.js'
import { TaskSchema } from './task.js'

export const MemoSchema = z.object({
  id: Id,
  content: z.string(),
  tags: z.array(z.string()),
  pinned: z.boolean(),
  color: z.string(),
  convertedTaskId: Id.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
})
export type Memo = z.infer<typeof MemoSchema>

export const CreateMemoInput = z.object({
  content: z.string().trim().min(1).max(20_000),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  pinned: z.boolean().optional(),
  color: z.string().optional(),
})
export type CreateMemoInput = z.infer<typeof CreateMemoInput>

export const UpdateMemoInput = z.object({
  id: Id,
  content: z.string().trim().min(1).max(20_000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  pinned: z.boolean().optional(),
  color: z.string().optional(),
})
export type UpdateMemoInput = z.infer<typeof UpdateMemoInput>

export const ListMemosInput = Pagination.extend({
  tag: z.string().max(40).optional(),
  search: z.string().max(200).optional(),
  pinnedOnly: z.boolean().optional(),
  from: DateOnly.optional(),
  to: DateOnly.optional(),
})
export type ListMemosInput = z.infer<typeof ListMemosInput>

export const MemoRefInput = z.object({ id: Id })
export type MemoRefInput = z.infer<typeof MemoRefInput>

export const MemoToTaskInput = z.object({
  id: Id,
  title: z.string().trim().min(1).max(500).optional(),
  projectId: Id.nullish(),
  scheduledDate: DateOnly.nullish(),
})
export type MemoToTaskInput = z.infer<typeof MemoToTaskInput>

export const MemoToTaskResult = z.object({
  memo: MemoSchema,
  task: TaskSchema,
})

export const MemoTagCount = z.object({
  tag: z.string(),
  count: z.number().int(),
})

export const MemoStats = z.object({
  total: z.number().int(),
  today: z.number().int(),
  tags: z.array(MemoTagCount),
  streakDays: z.number().int(),
})
export type MemoStats = z.infer<typeof MemoStats>

export const InboxCaptureInput = z.object({
  content: z.string().trim().min(1).max(20_000),
  kind: z.enum(['memo', 'task']).default('memo'),
  tags: z.array(z.string().max(40)).max(20).optional(),
})
export type InboxCaptureInput = z.infer<typeof InboxCaptureInput>

export const InboxItemSchema = z.object({
  id: Id,
  ownerType: z.enum(['task', 'memo']),
  ownerId: Id,
  preview: z.string(),
  createdAt: IsoDateTime,
})
export type InboxItem = z.infer<typeof InboxItemSchema>

export { HexColor }
