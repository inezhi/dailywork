import { z } from 'zod'
import {
  DateOnly,
  Id,
  IsoDateTime,
  Pagination,
  TaskPriority,
  TaskStatus,
  TimeOnly,
} from './common.js'

export const TagSchema = z.object({
  id: Id,
  name: z.string(),
  color: z.string(),
  createdAt: IsoDateTime,
})
export type Tag = z.infer<typeof TagSchema>

export const TaskSchema = z.object({
  id: Id,
  spaceId: Id,
  projectId: Id.nullable(),
  parentId: Id.nullable(),
  title: z.string(),
  notes: z.string(),
  status: TaskStatus,
  priority: TaskPriority,
  scheduledDate: DateOnly.nullable(),
  scheduledTime: TimeOnly.nullable(),
  dueDate: DateOnly.nullable(),
  estimateMinutes: z.number().int().nullable(),
  actualMinutes: z.number().int().nullable(),
  sortOrder: z.number(),
  completedAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  version: z.number().int(),
  tags: z.array(TagSchema),
  subtaskTotal: z.number().int().optional(),
  subtaskDone: z.number().int().optional(),
  projectName: z.string().nullable().optional(),
  projectColor: z.string().nullable().optional(),
  spaceName: z.string().nullable().optional(),
  spaceColor: z.string().nullable().optional(),
})
export type Task = z.infer<typeof TaskSchema>

export const CreateTaskInput = z.object({
  title: z.string().trim().min(1, '任务标题不能为空').max(500),
  notes: z.string().max(100_000).optional(),
  status: TaskStatus.optional(),
  priority: TaskPriority.optional(),
  spaceId: Id.optional(),
  projectId: Id.nullish(),
  parentId: Id.nullish(),
  scheduledDate: DateOnly.nullish(),
  scheduledTime: TimeOnly.nullish(),
  dueDate: DateOnly.nullish(),
  estimateMinutes: z.number().int().min(0).max(24 * 60).nullish(),
  tagIds: z.array(Id).max(20).optional(),
  source: z.string().max(32).optional(),
  opId: z.string().max(64).optional(),
})
export type CreateTaskInput = z.infer<typeof CreateTaskInput>

const NullablePatch = <T extends z.ZodTypeAny>(schema: T) => schema.nullable().optional()

export const UpdateTaskInput = z.object({
  id: Id,
  title: z.string().trim().min(1).max(500).optional(),
  notes: z.string().max(100_000).optional(),
  status: TaskStatus.optional(),
  priority: TaskPriority.optional(),
  projectId: NullablePatch(Id),
  parentId: NullablePatch(Id),
  scheduledDate: NullablePatch(DateOnly),
  scheduledTime: NullablePatch(TimeOnly),
  dueDate: NullablePatch(DateOnly),
  estimateMinutes: z.number().int().min(0).max(24 * 60).nullable().optional(),
  tagIds: z.array(Id).max(20).optional(),
  sortOrder: z.number().optional(),
  expectedVersion: z.number().int().optional(),
  opId: z.string().max(64).optional(),
})
export type UpdateTaskInput = z.infer<typeof UpdateTaskInput>

export const TaskRefInput = z.object({
  id: Id,
  expectedVersion: z.number().int().optional(),
  opId: z.string().max(64).optional(),
})
export type TaskRefInput = z.infer<typeof TaskRefInput>

export const MoveTaskInput = z.object({
  id: Id,
  status: TaskStatus.optional(),
  sortOrder: z.number().optional(),
  projectId: NullablePatch(Id),
  scheduledDate: NullablePatch(DateOnly),
  expectedVersion: z.number().int().optional(),
  opId: z.string().max(64).optional(),
})
export type MoveTaskInput = z.infer<typeof MoveTaskInput>

export const ListTasksInput = Pagination.extend({
  status: z.array(TaskStatus).optional(),
  excludeStatus: z.array(TaskStatus).optional(),
  spaceId: Id.optional(),
  projectId: Id.optional(),
  parentId: Id.optional(),
  tagId: Id.optional(),
  scheduledDate: DateOnly.optional(),
  scheduledFrom: DateOnly.optional(),
  scheduledTo: DateOnly.optional(),
  dueBefore: DateOnly.optional(),
  dueAfter: DateOnly.optional(),
  unscheduled: z.boolean().optional(),
  search: z.string().max(200).optional(),
  sort: z
    .enum(['manual', 'scheduled', 'due', 'created', 'updated', 'priority', 'title'])
    .optional(),
  includeArchived: z.boolean().optional(),
})
export type ListTasksInput = z.infer<typeof ListTasksInput>

export const TodayInput = z.object({
  date: DateOnly.optional(),
  spaceId: Id.optional(),
})
export type TodayInput = z.infer<typeof TodayInput>

export const TodayResult = z.object({
  date: DateOnly,
  capacityMinutes: z.number().int(),
  note: z.string(),
  scheduled: z.array(TaskSchema),
  due: z.array(TaskSchema),
  overdue: z.array(TaskSchema),
  completed: z.array(TaskSchema),
  inboxCount: z.number().int(),
  focusMinutes: z.number().int(),
  plannedMinutes: z.number().int(),
  completedMinutes: z.number().int(),
})
export type TodayResult = z.infer<typeof TodayResult>

export const CreateTagInput = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})
export type CreateTagInput = z.infer<typeof CreateTagInput>

export const UpdateTagInput = z.object({
  id: Id,
  name: z.string().trim().min(1).max(40).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})
export type UpdateTagInput = z.infer<typeof UpdateTagInput>

export const TagRefInput = z.object({ id: Id })
export type TagRefInput = z.infer<typeof TagRefInput>

export const TaskListResult = z.object({
  items: z.array(TaskSchema),
  total: z.number().int(),
})
