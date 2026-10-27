import {
  OpError,
  type CalendarEvent,
  type CalendarRangeInput,
  type CreateRoutineInput,
  type Routine,
  type SetCapacityInput,
  type TimelineItem,
  type TimelineRangeInput,
  type WeekReviewResult,
} from '@daily/contracts'
import {
  addDays,
  dateRange,
  endOfWeek,
  localDayBoundsUtc,
  newId,
  nowIso,
  startOfWeek,
  todayLocal,
  toDateOnly,
  type Db,
} from '@daily/platform'
import {
  calendarTasks,
  tasksCompletedBetween,
  tasksScheduledOn,
} from '@daily/context-tasking'
import { getSettings } from '@daily/context-workspace'

export interface DayPlan {
  date: string
  capacityMinutes: number
  plannedMinutes: number
  completedMinutes: number
  tasks: ReturnType<typeof tasksScheduledOn>
}

export function getCapacityMinutes(db: Db, date: string): number {
  const row = db.prepare('SELECT capacity_minutes FROM capacity_days WHERE date = ?').get(date) as
    | { capacity_minutes: number }
    | undefined
  if (row) return row.capacity_minutes
  return getSettings(db).general.defaultCapacityMinutes
}

export function setCapacity(db: Db, input: SetCapacityInput): { date: string; capacityMinutes: number } {
  db.prepare(
    `INSERT INTO capacity_days(date, capacity_minutes, note, updated_at) VALUES(?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET capacity_minutes = excluded.capacity_minutes,
       note = excluded.note, updated_at = excluded.updated_at`,
  ).run(input.date, input.capacityMinutes, input.note ?? '', nowIso())
  return { date: input.date, capacityMinutes: input.capacityMinutes }
}

export function dayPlan(db: Db, date: string, spaceId?: string): DayPlan {
  const tasks = tasksScheduledOn(db, date, spaceId)
  const plannedMinutes = tasks.reduce((acc, t) => acc + (t.estimateMinutes ?? 0), 0)
  const completedMinutes = tasks
    .filter((t) => t.status === 'done')
    .reduce((acc, t) => acc + (t.estimateMinutes ?? 0), 0)
  return {
    date,
    capacityMinutes: getCapacityMinutes(db, date),
    plannedMinutes,
    completedMinutes,
    tasks,
  }
}

export function calendarRange(db: Db, input: CalendarRangeInput): { events: CalendarEvent[] } {
  const tasks = calendarTasks(db, input.from, input.to, {
    spaceId: input.spaceId,
    projectId: input.projectId,
    includeCompleted: input.includeCompleted,
  })
  const events: CalendarEvent[] = []
  for (const task of tasks) {
    if (
      task.scheduledDate &&
      task.scheduledDate >= input.from &&
      task.scheduledDate <= input.to
    ) {
      events.push({
        task,
        date: task.scheduledDate,
        endDate: task.dueDate && task.dueDate > task.scheduledDate ? task.dueDate : null,
        time: task.scheduledTime,
        kind: 'scheduled',
      })
    }
    if (task.dueDate && task.dueDate >= input.from && task.dueDate <= input.to) {
      events.push({
        task,
        date: task.dueDate,
        endDate: null,
        time: null,
        kind: 'due',
      })
    }
  }
  events.sort((a, b) => (a.date + (a.time ?? '99:99')).localeCompare(b.date + (b.time ?? '99:99')))
  return { events }
}

export function timelineRange(db: Db, input: TimelineRangeInput): { items: TimelineItem[] } {
  const tasks = calendarTasks(db, input.from, input.to, {
    spaceId: input.spaceId,
    projectId: input.projectId,
    includeCompleted: true,
  })
  const items: TimelineItem[] = []
  for (const task of tasks) {
    const start = task.scheduledDate ?? task.dueDate
    if (!start) continue
    let end = task.dueDate && task.dueDate >= start ? task.dueDate : start
    if (task.scheduledDate && task.estimateMinutes && !task.dueDate) {
      end = task.scheduledDate
    }
    if (end < input.from || start > input.to) continue
    items.push({ task, start, end })
  }
  return { items }
}

export function weekReview(db: Db, weekStartInput?: string): WeekReviewResult {
  const today = todayLocal()
  const weekStart = weekStartInput ?? startOfWeek(today, getSettings(db).general.weekStartsOn)
  const weekEnd = endOfWeek(weekStart, getSettings(db).general.weekStartsOn)
  const bounds = localDayBoundsUtc(weekStart)
  const endBounds = localDayBoundsUtc(addDays(weekEnd, 1))
  const completed = tasksCompletedBetween(db, bounds.start, endBounds.start)
  const days = dateRange(weekStart, weekEnd)
  const byDay = days.map((date) => ({
    date,
    completed: completed.filter((t) => t.completedAt && toDateOnly(new Date(t.completedAt)) === date)
      .length,
  }))
  const projectMap = new Map<string | null, { name: string; count: number }>()
  for (const task of completed) {
    const key = task.projectId
    const entry = projectMap.get(key) ?? { name: task.projectName ?? '未归类', count: 0 }
    entry.count++
    projectMap.set(key, entry)
  }
  const byProject = [...projectMap.entries()].map(([projectId, v]) => ({
    projectId,
    name: v.name,
    count: v.count,
  }))
  const focusRow = db
    .prepare(
      `SELECT COALESCE(SUM(actual_seconds),0) AS seconds, COUNT(*) AS sessions
       FROM focus_sessions WHERE status = 'completed' AND started_at >= ? AND started_at < ?`,
    )
    .get(bounds.start, endBounds.start) as { seconds: number; sessions: number }
  const carriedOverRows = db
    .prepare(
      `SELECT COUNT(*) AS c FROM tasks WHERE archived_at IS NULL AND status != 'done'
       AND scheduled_date IS NOT NULL AND scheduled_date < ? AND scheduled_date >= ?`,
    )
    .get(weekStart, addDays(weekStart, -7)) as { c: number }
  const totalWeek = completed.length + carriedOverRows.c
  const completionRate = totalWeek === 0 ? 0 : completed.length / totalWeek
  const highlights: string[] = []
  const bestDay = [...byDay].sort((a, b) => b.completed - a.completed)[0]
  if (bestDay && bestDay.completed > 0) {
    highlights.push(`${bestDay.date} 完成 ${bestDay.completed} 项，是本周最高效的一天。`)
  }
  if (focusRow.seconds > 0) {
    highlights.push(`专注 ${Math.round(focusRow.seconds / 60)} 分钟，共 ${focusRow.sessions} 个会话。`)
  }
  if (byProject[0] && byProject[0].count > 0) {
    highlights.push(`「${byProject[0].name}」贡献了 ${byProject[0].count} 项完成。`)
  }
  if (highlights.length === 0) highlights.push('本周还没有完成任务，从今天的一件小事开始。')
  return {
    weekStart,
    weekEnd,
    completed,
    carriedOver: [],
    focusMinutes: Math.round(focusRow.seconds / 60),
    focusSessions: focusRow.sessions,
    completionRate,
    byProject,
    byDay,
    highlights,
  }
}

export function todaySummary(db: Db, date = todayLocal(), spaceId?: string) {
  const plan = dayPlan(db, date, spaceId)
  const focusRow = db
    .prepare(
      `SELECT COALESCE(SUM(actual_seconds),0) AS seconds FROM focus_sessions
       WHERE status = 'completed' AND started_at >= ? AND started_at < ?`,
    )
    .get(...Object.values(localDayBoundsUtc(date))) as { seconds: number }
  return {
    ...plan,
    focusMinutes: Math.round(focusRow.seconds / 60),
  }
}

// ---------- routines ----------

interface RoutineRow {
  id: string
  name: string
  time: string | null
  weekdays_json: string
  enabled: number
  created_at: string
}

function mapRoutine(row: RoutineRow): Routine {
  return {
    id: row.id,
    name: row.name,
    time: row.time,
    weekdays: JSON.parse(row.weekdays_json) as number[],
    enabled: row.enabled === 1,
    createdAt: row.created_at,
  }
}

export function listRoutines(db: Db): Routine[] {
  const rows = db.prepare('SELECT * FROM routines ORDER BY time, created_at').all() as unknown as RoutineRow[]
  return rows.map(mapRoutine)
}

export function createRoutine(db: Db, input: CreateRoutineInput): Routine {
  const id = newId('rtn')
  db.prepare(
    'INSERT INTO routines(id, name, time, weekdays_json, enabled, created_at) VALUES(?, ?, ?, ?, 1, ?)',
  ).run(id, input.name.trim(), input.time ?? null, JSON.stringify(input.weekdays), nowIso())
  const row = db.prepare('SELECT * FROM routines WHERE id = ?').get(id) as unknown as RoutineRow
  return mapRoutine(row)
}

export function toggleRoutine(db: Db, id: string, enabled: boolean): Routine {
  const row = db.prepare('SELECT * FROM routines WHERE id = ?').get(id) as RoutineRow | undefined
  if (!row) throw new OpError('NOT_FOUND', '例程不存在')
  db.prepare('UPDATE routines SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id)
  return mapRoutine({ ...row, enabled: enabled ? 1 : 0 })
}

export function deleteRoutine(db: Db, id: string): { id: string } {
  db.prepare('DELETE FROM routines WHERE id = ?').run(id)
  return { id }
}
