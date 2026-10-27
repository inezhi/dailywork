import {
  OpError,
  type ApplyTemplateInput,
  type CreateDeliverableInput,
  type CreateProjectInput,
  type CreateTemplateInput,
  type Deliverable,
  type ListProjectsInput,
  type Project,
  type TaskTemplate,
  type UpdateDeliverableInput,
  type UpdateProjectInput,
} from '@daily/contracts'
import { newId, nowIso, type Db } from '@daily/platform'
import { createTask } from '@daily/context-tasking'
import { getDefaultSpaceId } from '@daily/context-workspace'

interface ProjectRow {
  id: string
  space_id: string
  name: string
  description: string
  color: string
  icon: string
  status: string
  start_date: string | null
  due_date: string | null
  acceptance_criteria: string
  sort_order: number
  archived_at: string | null
  created_at: string
  updated_at: string
  task_total?: number
  task_done?: number
  space_name?: string | null
  space_color?: string | null
}

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    spaceId: row.space_id,
    name: row.name,
    description: row.description,
    color: row.color,
    icon: row.icon,
    status: row.status as Project['status'],
    startDate: row.start_date,
    dueDate: row.due_date,
    acceptanceCriteria: row.acceptance_criteria,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    taskTotal: row.task_total ?? 0,
    taskDone: row.task_done ?? 0,
    spaceName: row.space_name ?? null,
    spaceColor: row.space_color ?? null,
  }
}

const PROJECT_SELECT = `
  SELECT p.*,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.archived_at IS NULL AND t.parent_id IS NULL) AS task_total,
    (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.archived_at IS NULL AND t.parent_id IS NULL AND t.status = 'done') AS task_done,
    sp.name AS space_name, sp.color AS space_color
  FROM projects p JOIN spaces sp ON sp.id = p.space_id
`

export function listProjects(db: Db, input: ListProjectsInput = {}): Project[] {
  const where: string[] = [input.includeArchived ? '1=1' : 'p.archived_at IS NULL']
  const params: string[] = []
  if (input.spaceId) {
    where.push('p.space_id = ?')
    params.push(input.spaceId)
  }
  if (input.status?.length) {
    where.push(`p.status IN (${input.status.map(() => '?').join(',')})`)
    params.push(...input.status)
  }
  if (input.search) {
    where.push('(p.name LIKE ? OR p.description LIKE ?)')
    params.push(`%${input.search}%`, `%${input.search}%`)
  }
  const rows = db
    .prepare(`${PROJECT_SELECT} WHERE ${where.join(' AND ')} ORDER BY p.sort_order, p.created_at DESC`)
    .all(...params) as unknown as ProjectRow[]
  return rows.map(mapProject)
}

export function getProject(db: Db, id: string): Project {
  const row = db.prepare(`${PROJECT_SELECT} WHERE p.id = ?`).get(id) as ProjectRow | undefined
  if (!row) throw new OpError('NOT_FOUND', '项目不存在')
  return mapProject(row)
}

export function createProject(db: Db, input: CreateProjectInput): Project {
  const spaceId = input.spaceId ?? getDefaultSpaceId(db)
  const space = db.prepare('SELECT 1 FROM spaces WHERE id = ? AND archived_at IS NULL').get(spaceId)
  if (!space) throw new OpError('NOT_FOUND', '空间不存在或已归档')
  const at = nowIso()
  const id = newId('prj')
  const max = db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM projects WHERE space_id = ?')
    .get(spaceId) as { m: number }
  db.prepare(
    `INSERT INTO projects(id, space_id, name, description, color, icon, status,
      start_date, due_date, acceptance_criteria, sort_order, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    spaceId,
    input.name.trim(),
    input.description ?? '',
    input.color ?? '#D97757',
    input.icon ?? 'folder',
    input.status ?? 'active',
    input.startDate ?? null,
    input.dueDate ?? null,
    input.acceptanceCriteria ?? '',
    max.m + 1,
    at,
    at,
  )
  return getProject(db, id)
}

export function updateProject(db: Db, input: UpdateProjectInput): Project {
  const current = db.prepare('SELECT * FROM projects WHERE id = ?').get(input.id) as
    | ProjectRow
    | undefined
  if (!current) throw new OpError('NOT_FOUND', '项目不存在')
  const sets: string[] = []
  const values: Array<string | null> = []
  const set = (col: string, val: string | null) => {
    sets.push(`${col} = ?`)
    values.push(val)
  }
  if (input.name !== undefined) set('name', input.name.trim())
  if (input.spaceId !== undefined) set('space_id', input.spaceId)
  if (input.description !== undefined) set('description', input.description)
  if (input.color !== undefined) set('color', input.color)
  if (input.icon !== undefined) set('icon', input.icon)
  if (input.status !== undefined) {
    set('status', input.status)
    set('archived_at', input.status === 'archived' ? nowIso() : null)
  }
  if (input.startDate !== undefined) set('start_date', input.startDate ?? null)
  if (input.dueDate !== undefined) set('due_date', input.dueDate ?? null)
  if (input.acceptanceCriteria !== undefined) set('acceptance_criteria', input.acceptanceCriteria)
  if (sets.length > 0) {
    sets.push('updated_at = ?')
    values.push(nowIso())
    db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...values, input.id)
  }
  return getProject(db, input.id)
}

export function archiveProject(db: Db, id: string): Project {
  return updateProject(db, { id, status: 'archived' })
}

export function deleteProject(db: Db, id: string): { id: string } {
  db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  return { id }
}

export function projectStats(db: Db, id: string): {
  total: number
  done: number
  waiting: number
  blocked: number
  overdue: number
  openEstimateMinutes: number
} {
  const row = db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
        SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) AS waiting,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked,
        SUM(CASE WHEN status != 'done' AND due_date IS NOT NULL AND due_date < date('now','localtime') THEN 1 ELSE 0 END) AS overdue,
        COALESCE(SUM(CASE WHEN status != 'done' THEN estimate_minutes ELSE 0 END), 0) AS open_estimate
      FROM tasks WHERE project_id = ? AND archived_at IS NULL AND parent_id IS NULL`,
    )
    .get(id) as {
    total: number | null
    done: number | null
    waiting: number | null
    blocked: number | null
    overdue: number | null
    open_estimate: number | null
  }
  return {
    total: row.total ?? 0,
    done: row.done ?? 0,
    waiting: row.waiting ?? 0,
    blocked: row.blocked ?? 0,
    overdue: row.overdue ?? 0,
    openEstimateMinutes: row.open_estimate ?? 0,
  }
}

// ---------- deliverables ----------

interface DeliverableRow {
  id: string
  project_id: string
  title: string
  status: string
  due_date: string | null
  note: string
  sort_order: number
  created_at: string
  updated_at: string
}

function mapDeliverable(row: DeliverableRow): Deliverable {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    status: row.status as Deliverable['status'],
    dueDate: row.due_date,
    note: row.note,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listDeliverables(db: Db, projectId: string): Deliverable[] {
  const rows = db
    .prepare('SELECT * FROM deliverables WHERE project_id = ? ORDER BY sort_order, created_at')
    .all(projectId) as unknown as DeliverableRow[]
  return rows.map(mapDeliverable)
}

export function createDeliverable(db: Db, input: CreateDeliverableInput): Deliverable {
  const at = nowIso()
  const id = newId('dlv')
  const max = db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM deliverables WHERE project_id = ?')
    .get(input.projectId) as { m: number }
  db.prepare(
    `INSERT INTO deliverables(id, project_id, title, due_date, note, sort_order, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.projectId, input.title.trim(), input.dueDate ?? null, input.note ?? '', max.m + 1, at, at)
  return getDeliverable(db, id)
}

export function getDeliverable(db: Db, id: string): Deliverable {
  const row = db.prepare('SELECT * FROM deliverables WHERE id = ?').get(id) as
    | DeliverableRow
    | undefined
  if (!row) throw new OpError('NOT_FOUND', '交付成果不存在')
  return mapDeliverable(row)
}

export function updateDeliverable(db: Db, input: UpdateDeliverableInput): Deliverable {
  const current = db.prepare('SELECT * FROM deliverables WHERE id = ?').get(input.id) as
    | DeliverableRow
    | undefined
  if (!current) throw new OpError('NOT_FOUND', '交付成果不存在')
  const sets: string[] = []
  const values: Array<string | number | null> = []
  const set = (col: string, val: string | number | null) => {
    sets.push(`${col} = ?`)
    values.push(val)
  }
  if (input.title !== undefined) set('title', input.title.trim())
  if (input.status !== undefined) set('status', input.status)
  if (input.dueDate !== undefined) set('due_date', input.dueDate ?? null)
  if (input.note !== undefined) set('note', input.note)
  if (input.sortOrder !== undefined) set('sort_order', input.sortOrder)
  if (sets.length) {
    sets.push('updated_at = ?')
    values.push(nowIso())
    db.prepare(`UPDATE deliverables SET ${sets.join(', ')} WHERE id = ?`).run(...values, input.id)
  }
  return getDeliverable(db, input.id)
}

export function deleteDeliverable(db: Db, id: string): { id: string } {
  db.prepare('DELETE FROM deliverables WHERE id = ?').run(id)
  return { id }
}

// ---------- templates ----------

interface TemplateRow {
  id: string
  name: string
  description: string
  space_id: string | null
  project_id: string | null
  items_json: string
  created_at: string
  updated_at: string
}

function mapTemplate(row: TemplateRow): TaskTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    spaceId: row.space_id,
    projectId: row.project_id,
    items: JSON.parse(row.items_json) as TaskTemplate['items'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listTemplates(db: Db): TaskTemplate[] {
  const rows = db.prepare('SELECT * FROM templates ORDER BY created_at DESC').all() as unknown as TemplateRow[]
  return rows.map(mapTemplate)
}

export function createTemplate(db: Db, input: CreateTemplateInput): TaskTemplate {
  const at = nowIso()
  const id = newId('tpl')
  let spaceId: string | null = null
  if (input.projectId) {
    const project = db.prepare('SELECT space_id FROM projects WHERE id = ?').get(input.projectId) as
      | { space_id: string }
      | undefined
    spaceId = project?.space_id ?? null
  }
  db.prepare(
    `INSERT INTO templates(id, name, description, space_id, project_id, items_json, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.name.trim(),
    input.description ?? '',
    spaceId,
    input.projectId ?? null,
    JSON.stringify(input.items),
    at,
    at,
  )
  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as unknown as TemplateRow
  return mapTemplate(row)
}

export function deleteTemplate(db: Db, id: string): { id: string } {
  db.prepare('DELETE FROM templates WHERE id = ?').run(id)
  return { id }
}

export function applyTemplate(
  db: Db,
  input: ApplyTemplateInput,
): { created: number; taskIds: string[] } {
  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(input.id) as
    | TemplateRow
    | undefined
  if (!row) throw new OpError('NOT_FOUND', '模板不存在')
  const template = mapTemplate(row)
  const taskIds: string[] = []
  for (const item of template.items) {
    const task = createTask(
      { db, actor: 'user', source: 'gui' },
      {
        title: item.title,
        estimateMinutes: item.estimateMinutes ?? undefined,
        priority: item.priority,
        projectId: input.projectId ?? template.projectId ?? undefined,
        scheduledDate: input.scheduledDate ?? undefined,
      },
    )
    taskIds.push(task.id)
  }
  return { created: taskIds.length, taskIds }
}
