import {
  OpError,
  type Actor,
  type CreateTaskInput,
  type ListTasksInput,
  type ListResult,
  type MoveTaskInput,
  type Task,
  type UpdateTaskInput,
} from '@daily/contracts'
import {
  findOpLog,
  newId,
  newOpId,
  nowIso,
  recordOp,
  transaction,
  type Db,
} from '@daily/platform'
import {
  TASK_SELECT,
  defaultSpaceId,
  getTaskRow,
  mapRowsToTasks,
  mapTask,
  rowsToTagMap,
  type TaskRow,
} from './repo.js'

export interface ServiceContext {
  db: Db
  actor?: Actor
  source?: string
  now?: () => string
  command?: string
  summary?: string
}

interface Ctx {
  db: Db
  actor: string
  source: string
  now: () => string
  opId: string
}

function makeCtx(ctx: ServiceContext, opId?: string): Ctx {
  return {
    db: ctx.db,
    actor: ctx.actor ?? 'user',
    source: ctx.source ?? 'gui',
    now: ctx.now ?? nowIso,
    opId: opId ?? newOpId(),
  }
}

function existingOpResult(ctx: ServiceContext, opId?: string): Task | null {
  if (!opId) return null
  const record = findOpLog(ctx.db, opId)
  if (!record || !record.afterJson) return null
  return getTask(ctx.db, record.aggregateId)
}

const STATUS_RANK = `CASE t.status
  WHEN 'doing' THEN 0 WHEN 'next' THEN 1 WHEN 'waiting' THEN 2
  WHEN 'blocked' THEN 3 WHEN 'inbox' THEN 4 ELSE 5 END`

function nextSortOrder(db: Db, status: string, parentId: string | null): number {
  const row = db
    .prepare(
      `SELECT COALESCE(MAX(sort_order), 0) AS m FROM tasks
       WHERE status = ? AND archived_at IS NULL
         AND ${parentId ? 'parent_id = ?' : 'parent_id IS NULL'}`,
    )
    .get(...(parentId ? [status, parentId] : [status])) as { m: number }
  return row.m + 1024
}

export function getTask(db: Db, id: string): Task {
  const row = getTaskRow(db, id)
  if (!row) throw new OpError('NOT_FOUND', `任务不存在：${id}`)
  const tagMap = rowsToTagMap(db, [id])
  return mapTask(row, tagMap.get(id) ?? [])
}

export function createTask(ctx: ServiceContext, input: CreateTaskInput): Task {
  const existing = existingOpResult(ctx, input.opId)
  if (existing) return existing
  return transaction(ctx.db, () => {
    const c = makeCtx(ctx, input.opId)
    const at = c.now()
    const id = newId('tsk')

    let parent: TaskRow | null = null
    if (input.parentId) {
      parent = getTaskRow(ctx.db, input.parentId)
      if (!parent) throw new OpError('NOT_FOUND', '父任务不存在')
      if (parent.parent_id)
        throw new OpError('BAD_REQUEST', '暂不支持三层以上子任务', { parentId: parent.parent_id })
    }

    let spaceId = input.spaceId ?? parent?.space_id ?? defaultSpaceId(ctx.db)
    let projectId = input.projectId ?? parent?.project_id ?? null
    if (parent) {
      spaceId = parent.space_id
      projectId = parent.project_id ?? projectId
    }

    if (projectId) {
      const project = ctx.db
        .prepare('SELECT id, space_id, archived_at FROM projects WHERE id = ?')
        .get(projectId) as { id: string; space_id: string; archived_at: string | null } | undefined
      if (!project) throw new OpError('NOT_FOUND', '项目不存在')
      if (project.archived_at) throw new OpError('BAD_REQUEST', '项目已归档')
      spaceId = project.space_id
    } else {
      const space = ctx.db
        .prepare('SELECT id FROM spaces WHERE id = ? AND archived_at IS NULL')
        .get(spaceId) as { id: string } | undefined
      if (!space) throw new OpError('NOT_FOUND', '空间不存在或已归档')
    }
    if (parent && projectId) {
      projectId = parent.project_id ?? projectId
    }

    const status = input.status ?? 'next'
    const sortOrder = nextSortOrder(ctx.db, status, input.parentId ?? null)
    const title = input.title.trim()

    ctx.db
      .prepare(
        `INSERT INTO tasks(
          id, space_id, project_id, parent_id, title, notes, status, priority,
          scheduled_date, scheduled_time, due_date, estimate_minutes,
          sort_order, completed_at, created_at, updated_at, version
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      )
      .run(
        id,
        spaceId,
        projectId,
        input.parentId ?? null,
        title,
        input.notes ?? '',
        status,
        input.priority ?? 'none',
        input.scheduledDate ?? null,
        input.scheduledTime ?? null,
        input.dueDate ?? null,
        input.estimateMinutes ?? null,
        sortOrder,
        status === 'done' ? at : null,
        at,
        at,
      )

    if (input.tagIds?.length) attachTags(ctx.db, id, input.tagIds)

    const task = getTask(ctx.db, id)
    recordOp(ctx.db, {
      opId: c.opId,
      ts: at,
      actor: c.actor,
      source: c.source,
      command: 'task.create',
      aggregateType: 'task',
      aggregateId: id,
      summary: `创建任务「${title}」`,
      payload: input,
      after: task,
    })
    return task
  })
}

export function updateTask(ctx: ServiceContext, input: UpdateTaskInput): Task {
  const existing = existingOpResult(ctx, input.opId)
  if (existing) return existing
  return transaction(ctx.db, () => {
    const c = makeCtx(ctx, input.opId)
    const current = getTaskRow(ctx.db, input.id)
    if (!current) throw new OpError('NOT_FOUND', '任务不存在')
    if (input.expectedVersion != null && input.expectedVersion !== current.version) {
      throw new OpError('VERSION_CONFLICT', '任务已被修改，请刷新后重试', {
        expected: input.expectedVersion,
        actual: current.version,
      })
    }

    const sets: string[] = []
    const values: Array<string | number | null> = []
    const set = (column: string, value: string | number | null) => {
      sets.push(`${column} = ?`)
      values.push(value)
    }

    if (input.title !== undefined) set('title', input.title.trim())
    if (input.notes !== undefined) set('notes', input.notes)
    if (input.priority !== undefined) set('priority', input.priority)
    if (input.projectId !== undefined) {
      if (input.projectId) {
        const project = ctx.db
          .prepare('SELECT id, space_id FROM projects WHERE id = ? AND archived_at IS NULL')
          .get(input.projectId) as { id: string; space_id: string } | undefined
        if (!project) throw new OpError('NOT_FOUND', '项目不存在或已归档')
        set('project_id', input.projectId)
        set('space_id', project.space_id)
      } else {
        set('project_id', null)
      }
    }
    if (input.parentId !== undefined) {
      if (input.parentId) {
        const parent = getTaskRow(ctx.db, input.parentId)
        if (!parent) throw new OpError('NOT_FOUND', '父任务不存在')
        if (parent.parent_id || parent.id === input.id) {
          throw new OpError('BAD_REQUEST', '无效的父任务')
        }
      }
      set('parent_id', input.parentId ?? null)
    }
    if (input.scheduledDate !== undefined) set('scheduled_date', input.scheduledDate ?? null)
    if (input.scheduledTime !== undefined) set('scheduled_time', input.scheduledTime ?? null)
    if (input.dueDate !== undefined) set('due_date', input.dueDate ?? null)
    if (input.estimateMinutes !== undefined) set('estimate_minutes', input.estimateMinutes ?? null)
    if (input.sortOrder !== undefined) set('sort_order', input.sortOrder)

    if (input.status !== undefined && input.status !== current.status) {
      set('status', input.status)
      if (input.status === 'done') {
        set('completed_at', c.now())
      } else if (current.status === 'done') {
        set('completed_at', null)
      }
      if (input.status !== 'done') set('sort_order', nextSortOrder(ctx.db, input.status, current.parent_id))
    }

    if (sets.length > 0) {
      sets.push('updated_at = ?', 'version = version + 1')
      values.push(c.now())
      ctx.db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...values, input.id)
    }
    if (input.tagIds !== undefined) {
      ctx.db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(input.id)
      if (input.tagIds.length) attachTags(ctx.db, input.id, input.tagIds)
    }

    const task = getTask(ctx.db, input.id)
    recordOp(ctx.db, {
      opId: c.opId,
      ts: c.now(),
      actor: c.actor,
      source: c.source,
      command: ctx.command ?? 'task.update',
      aggregateType: 'task',
      aggregateId: input.id,
      summary: ctx.summary ?? `更新任务「${task.title}」`,
      payload: input,
      after: task,
    })
    return task
  })
}

export function moveTask(ctx: ServiceContext, input: MoveTaskInput): Task {
  return updateTask(ctx, {
    id: input.id,
    status: input.status,
    projectId: input.projectId,
    scheduledDate: input.scheduledDate,
    sortOrder: input.sortOrder,
    expectedVersion: input.expectedVersion,
    opId: input.opId,
  })
}

export function completeTask(ctx: ServiceContext, input: { id: string; opId?: string; expectedVersion?: number }): Task {
  return updateTask(
    { ...ctx, command: 'task.complete', summary: '完成任务' },
    {
      id: input.id,
      status: 'done',
      expectedVersion: input.expectedVersion,
      opId: input.opId,
    },
  )
}

export function reopenTask(ctx: ServiceContext, input: { id: string; opId?: string }): Task {
  return updateTask(
    { ...ctx, command: 'task.reopen', summary: '重新打开任务' },
    { id: input.id, status: 'next', opId: input.opId },
  )
}

export function deleteTask(ctx: ServiceContext, input: { id: string; opId?: string }): { id: string } {
  return transaction(ctx.db, () => {
    const c = makeCtx(ctx, input.opId)
    const current = getTaskRow(ctx.db, input.id)
    if (!current) return { id: input.id }
    const task = getTask(ctx.db, input.id)
    ctx.db.prepare('DELETE FROM tasks WHERE id = ?').run(input.id)
    recordOp(ctx.db, {
      opId: c.opId,
      ts: c.now(),
      actor: c.actor,
      source: c.source,
      command: 'task.delete',
      aggregateType: 'task',
      aggregateId: input.id,
      summary: `删除任务「${current.title}」`,
      payload: { id: input.id },
      after: { deleted: true, task },
    })
    return { id: input.id }
  })
}

function attachTags(db: Db, taskId: string, tagIds: string[]): void {
  const unique = [...new Set(tagIds)]
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO task_tags(task_id, tag_id) SELECT ?, id FROM tags WHERE id = ?',
  )
  for (const tagId of unique) stmt.run(taskId, tagId)
}

export function listTasks(ctx: ServiceContext, input: ListTasksInput): ListResult<Task> {
  const where: string[] = ['t.archived_at IS NULL']
  const params: Array<string | number> = []

  if (input.parentId) {
    where.push('t.parent_id = ?')
    params.push(input.parentId)
  } else {
    where.push('t.parent_id IS NULL')
  }
  if (input.status?.length) {
    where.push(`t.status IN (${input.status.map(() => '?').join(',')})`)
    params.push(...input.status)
  }
  if (input.excludeStatus?.length) {
    where.push(`t.status NOT IN (${input.excludeStatus.map(() => '?').join(',')})`)
    params.push(...input.excludeStatus)
  }
  if (input.spaceId) {
    where.push('t.space_id = ?')
    params.push(input.spaceId)
  }
  if (input.projectId) {
    where.push('t.project_id = ?')
    params.push(input.projectId)
  }
  if (input.tagId) {
    where.push('EXISTS (SELECT 1 FROM task_tags tt WHERE tt.task_id = t.id AND tt.tag_id = ?)')
    params.push(input.tagId)
  }
  if (input.scheduledDate) {
    where.push('t.scheduled_date = ?')
    params.push(input.scheduledDate)
  }
  if (input.scheduledFrom) {
    where.push('t.scheduled_date >= ?')
    params.push(input.scheduledFrom)
  }
  if (input.scheduledTo) {
    where.push('t.scheduled_date <= ?')
    params.push(input.scheduledTo)
  }
  if (input.unscheduled) where.push('t.scheduled_date IS NULL')
  if (input.dueBefore) {
    where.push('t.due_date IS NOT NULL AND t.due_date <= ?')
    params.push(input.dueBefore)
  }
  if (input.dueAfter) {
    where.push('t.due_date >= ?')
    params.push(input.dueAfter)
  }
  if (input.search) {
    where.push('(t.title LIKE ? OR t.notes LIKE ?)')
    const q = `%${input.search}%`
    params.push(q, q)
  }

  const whereSql = where.join(' AND ')
  const totalRow = ctx.db
    .prepare(`SELECT COUNT(*) AS c FROM tasks t WHERE ${whereSql}`)
    .get(...params) as { c: number }

  const order = (() => {
    switch (input.sort) {
      case 'scheduled':
        return 't.scheduled_date IS NULL, t.scheduled_date, t.scheduled_time, t.sort_order'
      case 'due':
        return 't.due_date IS NULL, t.due_date, t.sort_order'
      case 'created':
        return 't.created_at DESC'
      case 'updated':
        return 't.updated_at DESC'
      case 'priority':
        return `CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2
                WHEN 'low' THEN 3 ELSE 4 END, t.sort_order`
      case 'title':
        return 't.title COLLATE NOCASE'
      default:
        return `${STATUS_RANK}, t.sort_order, t.created_at`
    }
  })()

  const rows = ctx.db
    .prepare(`${TASK_SELECT} WHERE ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, input.limit, input.offset) as unknown as TaskRow[]
  return { items: mapRowsToTasks(ctx.db, rows), total: totalRow.c }
}

export function tasksScheduledOn(db: Db, date: string, spaceId?: string): Task[] {
  const params: Array<string | number> = [date]
  let extra = ''
  if (spaceId) {
    extra = ' AND t.space_id = ?'
    params.push(spaceId)
  }
  const rows = db
    .prepare(
      `${TASK_SELECT} WHERE t.archived_at IS NULL AND t.scheduled_date = ?${extra}
       ORDER BY t.scheduled_time IS NULL, t.scheduled_time, t.sort_order`,
    )
    .all(...params) as unknown as TaskRow[]
  return mapRowsToTasks(db, rows)
}

export function tasksDueOn(db: Db, date: string, spaceId?: string): Task[] {
  const params: Array<string | number> = [date]
  let extra = ''
  if (spaceId) {
    extra = ' AND t.space_id = ?'
    params.push(spaceId)
  }
  const rows = db
    .prepare(
      `${TASK_SELECT} WHERE t.archived_at IS NULL AND t.due_date = ? AND t.status != 'done'${extra}
       ORDER BY t.sort_order`,
    )
    .all(...params) as unknown as TaskRow[]
  return mapRowsToTasks(db, rows)
}

export function tasksOverdue(db: Db, date: string, spaceId?: string, limit = 20): Task[] {
  const params: Array<string | number> = [date]
  let extra = ''
  if (spaceId) {
    extra = ' AND t.space_id = ?'
    params.push(spaceId)
  }
  const rows = db
    .prepare(
      `${TASK_SELECT} WHERE t.archived_at IS NULL AND t.status != 'done'
       AND t.due_date IS NOT NULL AND t.due_date < ?${extra}
       ORDER BY t.due_date, t.sort_order LIMIT ${limit}`,
    )
    .all(...params) as unknown as TaskRow[]
  return mapRowsToTasks(db, rows)
}

export function tasksCompletedBetween(db: Db, fromIso: string, toIso: string, spaceId?: string): Task[] {
  const params: Array<string | number> = [fromIso, toIso]
  let extra = ''
  if (spaceId) {
    extra = ' AND t.space_id = ?'
    params.push(spaceId)
  }
  const rows = db
    .prepare(
      `${TASK_SELECT} WHERE t.status = 'done' AND t.completed_at >= ? AND t.completed_at < ?${extra}
       ORDER BY t.completed_at DESC`,
    )
    .all(...params) as unknown as TaskRow[]
  return mapRowsToTasks(db, rows)
}

export function countInbox(db: Db, spaceId?: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM tasks t WHERE t.archived_at IS NULL AND t.parent_id IS NULL
       AND t.status = 'inbox'${spaceId ? ' AND t.space_id = ?' : ''}`,
    )
    .get(...(spaceId ? [spaceId] : [])) as { c: number }
  return row.c
}

export function calendarTasks(
  db: Db,
  from: string,
  to: string,
  opts: { spaceId?: string; projectId?: string; includeCompleted?: boolean } = {},
): Task[] {
  const where = [
    't.archived_at IS NULL',
    '(t.scheduled_date BETWEEN ? AND ? OR t.due_date BETWEEN ? AND ?)',
    't.parent_id IS NULL',
  ]
  const params: Array<string | number> = [from, to, from, to]
  if (opts.spaceId) {
    where.push('t.space_id = ?')
    params.push(opts.spaceId)
  }
  if (opts.projectId) {
    where.push('t.project_id = ?')
    params.push(opts.projectId)
  }
  if (!opts.includeCompleted) where.push(`t.status != 'done'`)
  const rows = db
    .prepare(`${TASK_SELECT} WHERE ${where.join(' AND ')} ORDER BY t.scheduled_date, t.sort_order`)
    .all(...params) as unknown as TaskRow[]
  return mapRowsToTasks(db, rows)
}

export function searchTasks(db: Db, query: string, limit = 10): Task[] {
  const q = `%${query}%`
  const rows = db
    .prepare(
      `${TASK_SELECT} WHERE t.archived_at IS NULL AND (t.title LIKE ? OR t.notes LIKE ?)
       ORDER BY (t.title LIKE ?) DESC, t.updated_at DESC LIMIT ?`,
    )
    .all(q, q, q, limit) as unknown as TaskRow[]
  return mapRowsToTasks(db, rows)
}

export function taskCountsByStatus(db: Db): Array<{ status: string; count: number }> {
  return db
    .prepare(
      `SELECT status, COUNT(*) AS count FROM tasks
       WHERE archived_at IS NULL AND parent_id IS NULL GROUP BY status`,
    )
    .all() as Array<{ status: string; count: number }>
}

export interface TaskActivityEntry {
  opId: string
  command: string
  summary: string
  ts: string
  actor: string
  source: string
}

export function taskActivity(db: Db, taskId: string, limit = 40): TaskActivityEntry[] {
  return db
    .prepare(
      `SELECT op_id AS opId, command, summary, ts, actor, source
       FROM op_log WHERE aggregate_type = 'task' AND aggregate_id = ?
       ORDER BY ts DESC LIMIT ?`,
    )
    .all(taskId, limit) as unknown as TaskActivityEntry[]
}
