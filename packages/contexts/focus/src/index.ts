import {
  OpError,
  type FinishFocusInput,
  type FocusSession,
  type FocusStats,
  type ListFocusInput,
  type ListResult,
  type StartFocusInput,
} from '@daily/contracts'
import {
  addDays,
  endOfWeek,
  localDayBoundsUtc,
  newId,
  nowIso,
  startOfWeek,
  todayLocal,
  toDateOnly,
  type Db,
} from '@daily/platform'
import { getTask } from '@daily/context-tasking'

interface FocusRow {
  id: string
  task_id: string | null
  task_title?: string | null
  mode: string
  planned_minutes: number
  started_at: string
  ended_at: string | null
  actual_seconds: number
  status: string
  note: string
}

function mapSession(row: FocusRow): FocusSession {
  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title ?? null,
    mode: row.mode as FocusSession['mode'],
    plannedMinutes: row.planned_minutes,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    actualSeconds: row.actual_seconds,
    status: row.status as FocusSession['status'],
    note: row.note,
  }
}

const FOCUS_SELECT = `
  SELECT f.*, t.title AS task_title FROM focus_sessions f
  LEFT JOIN tasks t ON t.id = f.task_id
`

export function getSession(db: Db, id: string): FocusSession {
  const row = db.prepare(`${FOCUS_SELECT} WHERE f.id = ?`).get(id) as FocusRow | undefined
  if (!row) throw new OpError('NOT_FOUND', '专注会话不存在')
  return mapSession(row)
}

export function activeSession(db: Db): FocusSession | null {
  const row = db
    .prepare(`${FOCUS_SELECT} WHERE f.status = 'running' ORDER BY f.started_at DESC LIMIT 1`)
    .get() as FocusRow | undefined
  return row ? mapSession(row) : null
}

export function cleanupStaleFocus(db: Db, maxAgeHours = 6): void {
  const cutoff = new Date(Date.now() - maxAgeHours * 3600_000).toISOString()
  db.prepare(
    `UPDATE focus_sessions SET status = 'cancelled', ended_at = ?, actual_seconds = 0
     WHERE status = 'running' AND started_at < ?`,
  ).run(nowIso(), cutoff)
}

export function startFocus(db: Db, input: StartFocusInput): FocusSession {
  cleanupStaleFocus(db)
  const running = activeSession(db)
  if (running) {
    throw new OpError('CONFLICT', '已有进行中的专注会话', { session: running })
  }
  const taskId = input.taskId ?? null
  if (taskId) {
    getTask(db, taskId)
  }
  const now = new Date()
  const id = newId('foc')
  db.prepare(
    `INSERT INTO focus_sessions(id, task_id, mode, planned_minutes, started_at, status)
     VALUES(?, ?, ?, ?, ?, 'running')`,
  ).run(id, taskId, input.mode ?? 'focus', input.minutes, now.toISOString())
  return getSession(db, id)
}

export function finishFocus(db: Db, input: FinishFocusInput): FocusSession {
  const current = getSession(db, input.id)
  if (current.status !== 'running') return current
  const endedAt = nowIso()
  const actualSeconds =
    input.actualSeconds ??
    Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(current.startedAt)) / 1000))
  const status = input.outcome === 'cancelled' ? 'cancelled' : 'completed'
  db.prepare(
    'UPDATE focus_sessions SET ended_at = ?, actual_seconds = ?, status = ?, note = ? WHERE id = ?',
  ).run(endedAt, status === 'completed' ? actualSeconds : actualSeconds, status, input.note ?? '', input.id)
  if (current.taskId && status === 'completed' && current.mode === 'focus') {
    const minutes = Math.round(actualSeconds / 60)
    db.prepare(
      'UPDATE tasks SET actual_minutes = COALESCE(actual_minutes, 0) + ?, updated_at = ? WHERE id = ?',
    ).run(minutes, endedAt, current.taskId)
  }
  return getSession(db, input.id)
}

export function cancelFocus(db: Db, input: { id: string; actualSeconds?: number }): FocusSession {
  return finishFocus(db, {
    id: input.id,
    outcome: 'cancelled',
    actualSeconds: input.actualSeconds,
  })
}

export function listFocus(db: Db, input: ListFocusInput): ListResult<FocusSession> {
  const where: string[] = ['f.mode = ?']
  const params: Array<string | number> = ['focus']
  if (input.from) {
    where.push('f.started_at >= ?')
    params.push(localDayBoundsUtc(input.from).start)
  }
  if (input.to) {
    where.push('f.started_at < ?')
    params.push(localDayBoundsUtc(input.to).end)
  }
  if (input.taskId) {
    where.push('f.task_id = ?')
    params.push(input.taskId)
  }
  const whereSql = where.join(' AND ')
  const total = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM focus_sessions f WHERE ${whereSql}`)
      .get(...params) as { c: number }
  ).c
  const rows = db
    .prepare(
      `${FOCUS_SELECT} WHERE ${whereSql} ORDER BY f.started_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, input.limit, input.offset) as unknown as FocusRow[]
  return { items: rows.map(mapSession), total }
}

export function focusStats(db: Db): FocusStats {
  const today = todayLocal()
  const todayBounds = localDayBoundsUtc(today)
  const weekStart = startOfWeek(today)
  const weekBounds = localDayBoundsUtc(weekStart)
  const weekEnd = localDayBoundsUtc(addDays(endOfWeek(today), 1))

  const todayRow = db
    .prepare(
      `SELECT COALESCE(SUM(actual_seconds),0) AS seconds, COUNT(*) AS sessions
       FROM focus_sessions WHERE status = 'completed' AND mode = 'focus'
       AND started_at >= ? AND started_at < ?`,
    )
    .get(todayBounds.start, todayBounds.end) as { seconds: number; sessions: number }
  const weekRow = db
    .prepare(
      `SELECT COALESCE(SUM(actual_seconds),0) AS seconds FROM focus_sessions
       WHERE status = 'completed' AND mode = 'focus' AND started_at >= ? AND started_at < ?`,
    )
    .get(weekBounds.start, weekEnd.start) as { seconds: number }
  const byTask = db
    .prepare(
      `SELECT f.task_id AS taskId, COALESCE(t.title, '未关联任务') AS title,
              ROUND(SUM(f.actual_seconds) / 60.0) AS minutes
       FROM focus_sessions f LEFT JOIN tasks t ON t.id = f.task_id
       WHERE f.status = 'completed' AND f.mode = 'focus' AND f.started_at >= ?
       GROUP BY f.task_id ORDER BY minutes DESC LIMIT 8`,
    )
    .all(weekBounds.start) as Array<{ taskId: string | null; title: string; minutes: number }>
  const days = db
    .prepare(
      `SELECT DISTINCT date(started_at, 'localtime') AS day FROM focus_sessions
       WHERE status = 'completed' AND mode = 'focus' ORDER BY day DESC LIMIT 400`,
    )
    .all() as Array<{ day: string }>
  const daySet = new Set(days.map((d) => d.day))
  let streak = 0
  let cursor = today
  if (!daySet.has(cursor)) cursor = addDays(cursor, -1)
  while (daySet.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return {
    todayMinutes: Math.round(todayRow.seconds / 60),
    todaySessions: todayRow.sessions,
    weekMinutes: Math.round(weekRow.seconds / 60),
    streakDays: streak,
    byTask,
  }
}

export function focusMinutesForDay(db: Db, date: string): number {
  const bounds = localDayBoundsUtc(date)
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(actual_seconds),0) AS seconds FROM focus_sessions
       WHERE status = 'completed' AND mode = 'focus' AND started_at >= ? AND started_at < ?`,
    )
    .get(bounds.start, bounds.end) as { seconds: number }
  return Math.round(row.seconds / 60)
}

export function focusDayBuckets(db: Db, days: number): Array<{ date: string; minutes: number }> {
  const out: Array<{ date: string; minutes: number }> = []
  const today = todayLocal()
  for (let i = days - 1; i >= 0; i--) {
    out.push({ date: addDays(today, -i), minutes: focusMinutesForDay(db, addDays(today, -i)) })
  }
  return out
}

export function sessionLocalDate(iso: string): string {
  return toDateOnly(new Date(iso))
}
