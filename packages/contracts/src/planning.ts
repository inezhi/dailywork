import { z } from 'zod'
import { DateOnly, Id, TimeOnly } from './common.js'
import { TaskSchema } from './task.js'

export const CalendarRangeInput = z.object({
  from: DateOnly,
  to: DateOnly,
  spaceId: Id.optional(),
  projectId: Id.optional(),
  includeCompleted: z.boolean().optional(),
})
export type CalendarRangeInput = z.infer<typeof CalendarRangeInput>

export const CalendarEventSchema = z.object({
  task: TaskSchema,
  date: DateOnly,
  endDate: DateOnly.nullable(),
  time: TimeOnly.nullable(),
  kind: z.enum(['scheduled', 'due']),
})
export type CalendarEvent = z.infer<typeof CalendarEventSchema>

export const CalendarRangeResult = z.object({
  events: z.array(CalendarEventSchema),
})

export const DayInput = z.object({
  date: DateOnly,
  spaceId: Id.optional(),
})
export type DayInput = z.infer<typeof DayInput>

export const CapacityDaySchema = z.object({
  date: DateOnly,
  capacityMinutes: z.number().int(),
  note: z.string(),
  plannedMinutes: z.number().int(),
  completedMinutes: z.number().int(),
})
export type CapacityDay = z.infer<typeof CapacityDaySchema>

export const SetCapacityInput = z.object({
  date: DateOnly,
  capacityMinutes: z.number().int().min(0).max(24 * 60),
  note: z.string().max(500).optional(),
})
export type SetCapacityInput = z.infer<typeof SetCapacityInput>

export const ScheduleTaskInput = z.object({
  id: Id,
  date: DateOnly.nullable(),
  time: TimeOnly.nullable().optional(),
  estimateMinutes: z.number().int().min(0).max(1440).nullable().optional(),
})
export type ScheduleTaskInput = z.infer<typeof ScheduleTaskInput>

export const TimelineRangeInput = z.object({
  from: DateOnly,
  to: DateOnly,
  spaceId: Id.optional(),
  projectId: Id.optional(),
})
export type TimelineRangeInput = z.infer<typeof TimelineRangeInput>

export const TimelineItemSchema = z.object({
  task: TaskSchema,
  start: DateOnly,
  end: DateOnly,
})
export type TimelineItem = z.infer<typeof TimelineItemSchema>

export const WeekReviewInput = z.object({
  weekStart: DateOnly.optional(),
})
export type WeekReviewInput = z.infer<typeof WeekReviewInput>

export const WeekReviewResult = z.object({
  weekStart: DateOnly,
  weekEnd: DateOnly,
  completed: z.array(TaskSchema),
  carriedOver: z.array(TaskSchema),
  focusMinutes: z.number().int(),
  focusSessions: z.number().int(),
  completionRate: z.number(),
  byProject: z.array(
    z.object({ projectId: Id.nullable(), name: z.string(), count: z.number().int() }),
  ),
  byDay: z.array(z.object({ date: DateOnly, completed: z.number().int() })),
  highlights: z.array(z.string()),
})
export type WeekReviewResult = z.infer<typeof WeekReviewResult>

export const RoutineSchema = z.object({
  id: Id,
  name: z.string(),
  time: TimeOnly.nullable(),
  weekdays: z.array(z.number().int().min(0).max(6)),
  enabled: z.boolean(),
  createdAt: z.string(),
})
export type Routine = z.infer<typeof RoutineSchema>

export const CreateRoutineInput = z.object({
  name: z.string().trim().min(1).max(120),
  time: TimeOnly.nullish(),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
})
export type CreateRoutineInput = z.infer<typeof CreateRoutineInput>

export const RoutineRefInput = z.object({ id: Id })
