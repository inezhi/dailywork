import {
  type DashboardInput,
  type DashboardResult,
  type SearchHit,
  type SearchAllInput,
} from '@daily/contracts'
import {
  addDays,
  localDayBoundsUtc,
  todayLocal,
  toDateOnly,
  dateRange,
  type Db,
} from '@daily/platform'
import { searchTasks, taskCountsByStatus } from '@daily/context-tasking'
import { focusMinutesForDay } from '@daily/context-focus'
import { listMemos } from '@daily/context-capture'
import { searchDocuments } from '@daily/context-documents'
import { listProjects } from '@daily/context-projects'

const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '12w': 84 }

export function dashboard(db: Db, input: DashboardInput): DashboardResult {
  const days = RANGE_DAYS[input.range] ?? 30
  const today = todayLocal()
  const from = addDays(today, -(days - 1))
  const fromBounds = localDayBoundsUtc(from)
  const toBounds = localDayBoundsUtc(today)
  const endExclusive = toBounds.end

  const completedRows = db
    .prepare(
      `SELECT id, title, due_date, completed_at, project_id, estimate_minutes, actual_minutes
       FROM tasks WHERE status = 'done' AND completed_at >= ? AND completed_at < ?
       AND archived_at IS NULL AND parent_id IS NULL`,
    )
    .all(fromBounds.start, endExclusive) as Array<{
    id: string
    title: string
    due_date: string | null
    completed_at: string
    project_id: string | null
    estimate_minutes: number | null
    actual_minutes: number | null
  }>

  const createdRows = db
    .prepare(
      `SELECT id, status FROM tasks WHERE created_at >= ? AND created_at < ?
       AND archived_at IS NULL AND parent_id IS NULL`,
    )
    .all(fromBounds.start, endExclusive) as Array<{ id: string; status: string }>
  const createdDone = createdRows.filter((t) => t.status === 'done').length

  const overdue = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM tasks WHERE archived_at IS NULL AND parent_id IS NULL
         AND status != 'done' AND due_date IS NOT NULL AND due_date < ?`,
      )
      .get(today) as { c: number }
  ).c

  const activeProjects = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM projects WHERE archived_at IS NULL AND status = 'active'`,
      )
      .get() as { c: number }
  ).c

  const onTimeBase = completedRows.filter((t) => t.due_date)
  const onTime = onTimeBase.filter(
    (t) => t.completed_at && toDateOnly(new Date(t.completed_at)) <= t.due_date!,
  ).length

  const estimateRows = completedRows.filter(
    (t) => t.estimate_minutes && t.estimate_minutes > 0 && t.actual_minutes != null,
  )
  const averageEstimateError =
    estimateRows.length === 0
      ? 0
      : estimateRows.reduce(
          (acc, t) => acc + Math.abs((t.actual_minutes ?? 0) - t.estimate_minutes!) / t.estimate_minutes!,
          0,
        ) / estimateRows.length

  const focusSecondsRow = db
    .prepare(
      `SELECT COALESCE(SUM(actual_seconds),0) AS seconds FROM focus_sessions
       WHERE status = 'completed' AND mode = 'focus' AND started_at >= ? AND started_at < ?`,
    )
    .get(fromBounds.start, endExclusive) as { seconds: number }
  const focusMinutes = Math.round(focusSecondsRow.seconds / 60)

  const dates = dateRange(from, today)
  const completedByDay = new Map<string, number>()
  for (const t of completedRows) {
    const day = toDateOnly(new Date(t.completed_at))
    completedByDay.set(day, (completedByDay.get(day) ?? 0) + 1)
  }
  const createdByDayRows = db
    .prepare(
      `SELECT date(created_at, 'localtime') AS day, COUNT(*) AS c FROM tasks
       WHERE created_at >= ? AND created_at < ? AND archived_at IS NULL AND parent_id IS NULL
       GROUP BY day`,
    )
    .all(fromBounds.start, endExclusive) as Array<{ day: string; c: number }>
  const createdByDay = new Map(createdByDayRows.map((r) => [r.day, r.c]))
  const focusByDay = new Map<string, number>()
  for (const day of dates) focusByDay.set(day, focusMinutesForDay(db, day))

  const trend = dates.map((date) => ({
    date,
    completed: completedByDay.get(date) ?? 0,
    created: createdByDay.get(date) ?? 0,
    focusMinutes: focusByDay.get(date) ?? 0,
  }))

  const byStatus = taskCountsByStatus(db)
  const bySpace = db
    .prepare(
      `SELECT sp.id AS spaceId, sp.name, sp.color, COUNT(t.id) AS open
       FROM spaces sp LEFT JOIN tasks t ON t.space_id = sp.id AND t.archived_at IS NULL
         AND t.parent_id IS NULL AND t.status != 'done'
       WHERE sp.archived_at IS NULL GROUP BY sp.id ORDER BY open DESC`,
    )
    .all() as Array<{ spaceId: string; name: string; color: string; open: number }>

  const projectFocus = db
    .prepare(
      `SELECT t.project_id AS projectId,
              ROUND(COALESCE(SUM(f.actual_seconds),0)/60.0) AS minutes
       FROM focus_sessions f JOIN tasks t ON t.id = f.task_id
       WHERE f.status = 'completed' AND f.mode = 'focus' AND f.started_at >= ? AND f.started_at < ?
       GROUP BY t.project_id`,
    )
    .all(fromBounds.start, endExclusive) as Array<{ projectId: string | null; minutes: number }>
  const projectFocusMap = new Map(projectFocus.map((r) => [r.projectId, r.minutes]))
  const projects = listProjects(db, { includeArchived: true })
  const completedByProject = new Map<string | null, number>()
  for (const t of completedRows) {
    completedByProject.set(t.project_id, (completedByProject.get(t.project_id) ?? 0) + 1)
  }
  const openByProjectRows = db
    .prepare(
      `SELECT project_id AS projectId, COUNT(*) AS c FROM tasks
       WHERE archived_at IS NULL AND status != 'done' AND parent_id IS NULL
       GROUP BY project_id`,
    )
    .all() as Array<{ projectId: string | null; c: number }>
  const openByProject = new Map(openByProjectRows.map((r) => [r.projectId, r.c]))
  const byProject: DashboardResult['byProject'] = projects
    .filter((p) => p.status !== 'archived')
    .map((p) => ({
      projectId: p.id,
      name: p.name,
      color: p.color,
      completed: completedByProject.get(p.id) ?? 0,
      open: openByProject.get(p.id) ?? 0,
      minutes: projectFocusMap.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.completed + b.open - (a.completed + a.open))
  const unassigned = completedByProject.get(null) ?? 0
  if (unassigned > 0) {
    byProject.push({
      projectId: null,
      name: '未归类',
      color: '#8A857D',
      completed: unassigned,
      open: openByProject.get(null) ?? 0,
      minutes: projectFocusMap.get(null) ?? 0,
    })
  }

  const inboxCount = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM tasks WHERE archived_at IS NULL AND parent_id IS NULL AND status = 'inbox'`,
      )
      .get() as { c: number }
  ).c

  const insights: DashboardResult['insights'] = []
  if (overdue > 0) {
    insights.push({
      id: 'overdue',
      tone: 'warning',
      title: `${overdue} 项已逾期`,
      body: '先处理最旧的一件，或者把它重新安排到有容量的日子。',
      actionLabel: '查看逾期',
      actionView: 'today',
    })
  }
  const completionRate = createdRows.length === 0 ? 0 : createdDone / createdRows.length
  if (createdRows.length > 0) {
    insights.push({
      id: 'completion',
      tone: completionRate >= 0.6 ? 'positive' : 'neutral',
      title: `本周期完成率 ${Math.round(completionRate * 100)}%`,
      body: `创建 ${createdRows.length} 项，完成 ${createdDone} 项。保持每天一件重要的事。`,
      actionLabel: null,
      actionView: null,
    })
  }
  const topProject = byProject.find((p) => p.completed > 0)
  if (topProject) {
    insights.push({
      id: 'project',
      tone: 'neutral',
      title: `${topProject.name} 是最近的推进主力`,
      body: `完成了 ${topProject.completed} 项，投入 ${topProject.minutes} 分钟专注。`,
      actionLabel: '打开项目',
      actionView: `project:${topProject.projectId}`,
    })
  }
  if (inboxCount > 0) {
    insights.push({
      id: 'inbox',
      tone: 'neutral',
      title: `收件箱还有 ${inboxCount} 项待整理`,
      body: '花五分钟决定下一步：安排日期、放进项目，或者删掉。',
      actionLabel: '整理收件箱',
      actionView: 'inbox',
    })
  }

  const attentionRows = db
    .prepare(
      `SELECT id, title, due_date, updated_at, status,
        CASE
          WHEN status = 'blocked' THEN 'blocked'
          WHEN due_date IS NOT NULL AND due_date < ? THEN 'overdue'
          WHEN due_date = ? THEN 'due-today'
          ELSE 'stale'
        END AS reason,
        CAST(julianday('now','localtime') - julianday(COALESCE(due_date, updated_at)) AS INTEGER) AS days
       FROM tasks
       WHERE archived_at IS NULL AND parent_id IS NULL AND status != 'done'
         AND (
           (due_date IS NOT NULL AND due_date <= ?)
           OR status = 'blocked'
           OR (due_date IS NULL AND updated_at < datetime('now','-7 day'))
         )
       ORDER BY CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date, updated_at
       LIMIT 8`,
    )
    .all(today, today, today) as Array<{
    id: string
    title: string
    due_date: string | null
    updated_at: string
    status: string
    reason: string
    days: number
  }>
  const needsAttention = attentionRows.map((r) => ({
    taskId: r.id,
    title: r.title,
    reason: r.reason as 'overdue' | 'stale' | 'blocked' | 'due-today',
    date: r.due_date,
    days: Math.max(0, r.days),
  }))

  return {
    range: input.range,
    from,
    to: today,
    kpi: {
      completed: completedRows.length,
      created: createdRows.length,
      completionRate,
      focusMinutes,
      overdue,
      activeProjects,
      onTimeRate: onTimeBase.length === 0 ? 0 : onTime / onTimeBase.length,
      averageEstimateError,
    },
    trend,
    byStatus,
    byProject,
    bySpace,
    insights,
    needsAttention,
  }
}

export function searchAll(db: Db, input: SearchAllInput): SearchHit[] {
  const hits: SearchHit[] = []
  for (const task of searchTasks(db, input.query, 8)) {
    hits.push({
      kind: 'task',
      id: task.id,
      title: task.title,
      snippet: task.notes.slice(0, 120),
      meta: task.projectName ?? task.status,
      score: 10,
    })
  }
  for (const memo of listMemos(db, { search: input.query, limit: 6, offset: 0 }).items) {
    hits.push({
      kind: 'memo',
      id: memo.id,
      title: memo.content.split('\n')[0]?.slice(0, 80) ?? '速记',
      snippet: memo.content.slice(0, 120),
      meta: memo.tags.join(' · '),
      score: 8,
    })
  }
  for (const doc of searchDocuments(db, input.query, 6)) {
    hits.push({
      kind: 'document',
      id: doc.id,
      title: doc.title,
      snippet: doc.excerpt,
      meta: '文档',
      score: 7,
    })
  }
  for (const project of listProjects(db, { search: input.query, includeArchived: false })) {
    hits.push({
      kind: 'project',
      id: project.id,
      title: project.name,
      snippet: project.description.slice(0, 120),
      meta: spaceLabel(project.spaceName),
      score: 6,
    })
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, input.limit)
}

function spaceLabel(name: string | null | undefined): string {
  return name ?? '项目'
}
