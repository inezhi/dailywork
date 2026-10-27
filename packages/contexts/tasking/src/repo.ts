import type { Db } from '@daily/platform'
import type { Tag, Task } from '@daily/contracts'

export interface TaskRow {
  id: string
  space_id: string
  project_id: string | null
  parent_id: string | null
  title: string
  notes: string
  status: string
  priority: string
  scheduled_date: string | null
  scheduled_time: string | null
  due_date: string | null
  estimate_minutes: number | null
  actual_minutes: number | null
  sort_order: number
  completed_at: string | null
  created_at: string
  updated_at: string
  version: number
  subtask_total?: number | null
  subtask_done?: number | null
  project_name?: string | null
  project_color?: string | null
  space_name?: string | null
  space_color?: string | null
}

export const TASK_SELECT = `
  SELECT t.*,
    (SELECT COUNT(*) FROM tasks s WHERE s.parent_id = t.id AND s.archived_at IS NULL) AS subtask_total,
    (SELECT COUNT(*) FROM tasks s WHERE s.parent_id = t.id AND s.status = 'done' AND s.archived_at IS NULL) AS subtask_done,
    p.name AS project_name,
    p.color AS project_color,
    sp.name AS space_name,
    sp.color AS space_color
  FROM tasks t
  LEFT JOIN projects p ON p.id = t.project_id
  LEFT JOIN spaces sp ON sp.id = t.space_id
`

export function rowsToTagMap(db: Db, taskIds: string[]): Map<string, Tag[]> {
  const map = new Map<string, Tag[]>()
  if (taskIds.length === 0) return map
  const placeholders = taskIds.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT tt.task_id, tg.id, tg.name, tg.color, tg.created_at
       FROM task_tags tt JOIN tags tg ON tg.id = tt.tag_id
       WHERE tt.task_id IN (${placeholders})
       ORDER BY tg.name COLLATE NOCASE`,
    )
    .all(...taskIds) as Array<{
    task_id: string
    id: string
    name: string
    color: string
    created_at: string
  }>
  for (const row of rows) {
    const list = map.get(row.task_id) ?? []
    list.push({ id: row.id, name: row.name, color: row.color, createdAt: row.created_at })
    map.set(row.task_id, list)
  }
  return map
}

export function mapTask(row: TaskRow, tags: Tag[] = []): Task {
  return {
    id: row.id,
    spaceId: row.space_id,
    projectId: row.project_id,
    parentId: row.parent_id,
    title: row.title,
    notes: row.notes,
    status: row.status as Task['status'],
    priority: row.priority as Task['priority'],
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    dueDate: row.due_date,
    estimateMinutes: row.estimate_minutes,
    actualMinutes: row.actual_minutes,
    sortOrder: row.sort_order,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    tags,
    subtaskTotal: row.subtask_total ?? 0,
    subtaskDone: row.subtask_done ?? 0,
    projectName: row.project_name ?? null,
    projectColor: row.project_color ?? null,
    spaceName: row.space_name ?? null,
    spaceColor: row.space_color ?? null,
  }
}

export function getTaskRow(db: Db, id: string): TaskRow | null {
  const row = db.prepare(`${TASK_SELECT} WHERE t.id = ?`).get(id) as TaskRow | undefined
  return row ?? null
}

export function mapRowsToTasks(db: Db, rows: TaskRow[]): Task[] {
  const tagMap = rowsToTagMap(
    db,
    rows.map((r) => r.id),
  )
  return rows.map((row) => mapTask(row, tagMap.get(row.id) ?? []))
}

export function defaultSpaceId(db: Db): string {
  const row = db
    .prepare('SELECT id FROM spaces WHERE archived_at IS NULL ORDER BY sort_order LIMIT 1')
    .get() as { id: string } | undefined
  if (!row) throw new Error('没有可用的空间')
  return row.id
}

export function taskExists(db: Db, id: string): boolean {
  return db.prepare('SELECT 1 FROM tasks WHERE id = ?').get(id) != null
}
