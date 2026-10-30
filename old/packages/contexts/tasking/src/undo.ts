import { OpError, type Actor, type Task } from '@daily/contracts'
import { newOpId, nowIso, recordOp, transaction, type Db } from '@daily/platform'
import { getTask } from './service.js'

interface UndoEntry {
  id: number
  op_id: string
  command: string
  aggregate_id: string
  before_json: string | null
  after_json: string | null
}

const UNDOABLE = [
  'task.create',
  'task.update',
  'task.move',
  'task.complete',
  'task.reopen',
  'task.delete',
]

export interface UndoResult {
  undone: boolean
  command: string
  task: Task | null
  summary: string
}

function parseTask(raw: string | null): Task | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Task | { task?: Task; deleted?: boolean }
    if ('task' in value && value.task) return value.task
    if ('id' in value && typeof value.id === 'string' && 'title' in value) return value as Task
    return null
  } catch {
    return null
  }
}

function restoreTags(db: Db, task: Task): void {
  db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(task.id)
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO task_tags(task_id, tag_id) SELECT ?, id FROM tags WHERE id = ?',
  )
  for (const tag of task.tags) stmt.run(task.id, tag.id)
}

function restoreExistingTask(db: Db, task: Task, at: string): Task {
  const result = db
    .prepare(
      `UPDATE tasks SET
        space_id = ?, project_id = ?, parent_id = ?, title = ?, notes = ?, status = ?,
        priority = ?, scheduled_date = ?, scheduled_time = ?, due_date = ?,
        estimate_minutes = ?, actual_minutes = ?, sort_order = ?, completed_at = ?,
        archived_at = NULL, updated_at = ?, version = version + 1
       WHERE id = ?`,
    )
    .run(
      task.spaceId,
      task.projectId,
      task.parentId,
      task.title,
      task.notes,
      task.status,
      task.priority,
      task.scheduledDate,
      task.scheduledTime,
      task.dueDate,
      task.estimateMinutes,
      task.actualMinutes,
      task.sortOrder,
      task.completedAt,
      at,
      task.id,
    )
  if (result.changes === 0) throw new OpError('NOT_FOUND', '任务已不存在，无法撤销')
  restoreTags(db, task)
  return getTask(db, task.id)
}

function restoreDeletedTask(db: Db, task: Task, at: string): Task {
  const exists = db.prepare('SELECT 1 FROM tasks WHERE id = ?').get(task.id)
  if (exists) throw new OpError('CONFLICT', '任务已经存在，无法恢复')
  try {
    db.prepare(
      `INSERT INTO tasks(
        id, space_id, project_id, parent_id, title, notes, status, priority,
        scheduled_date, scheduled_time, due_date, estimate_minutes, actual_minutes,
        sort_order, completed_at, archived_at, created_at, updated_at, version
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
    ).run(
      task.id,
      task.spaceId,
      task.projectId,
      task.parentId,
      task.title,
      task.notes,
      task.status,
      task.priority,
      task.scheduledDate,
      task.scheduledTime,
      task.dueDate,
      task.estimateMinutes,
      task.actualMinutes,
      task.sortOrder,
      task.completedAt,
      task.createdAt,
      at,
      task.version,
    )
  } catch (error) {
    throw new OpError(
      'CONFLICT',
      '任务依赖的空间、项目或父任务已不存在，无法恢复；请从备份中恢复。',
      error instanceof Error ? error.message : undefined,
    )
  }
  restoreTags(db, task)
  return getTask(db, task.id)
}

/**
 * Undo the most recent task command by applying its before snapshot. This is
 * intentionally task-scoped: projects, documents and AI conversations have
 * their own lifecycle and are not silently reverted.
 */
export function undoLastTaskOperation(
  db: Db,
  context: { actor?: Actor; source?: string } = {},
): UndoResult {
  const row = db
    .prepare(
      `SELECT id, op_id, command, aggregate_id, before_json, after_json
       FROM op_log WHERE command IN (${UNDOABLE.map(() => '?').join(',')})
       ORDER BY id DESC LIMIT 1`,
    )
    .get(...UNDOABLE) as UndoEntry | undefined
  if (!row) throw new OpError('NOT_FOUND', '没有可撤销的任务操作')
  const at = nowIso()
  return transaction(db, () => {
    const after = parseTask(row.after_json)
    const before = parseTask(row.before_json)
    let task: Task | null = null
    let summary = ''
    if (row.command === 'task.create') {
      const target = after ?? (row.aggregate_id ? getTask(db, row.aggregate_id) : null)
      if (!target) throw new OpError('NOT_FOUND', '要撤销的任务已不存在')
      db.prepare('DELETE FROM tasks WHERE id = ?').run(target.id)
      summary = `撤销创建「${target.title}」`
    } else if (row.command === 'task.delete') {
      if (!before) throw new OpError('UNSUPPORTED', '这条删除记录缺少快照，无法撤销')
      task = restoreDeletedTask(db, before, at)
      summary = `恢复「${before.title}」`
    } else {
      if (!before) throw new OpError('UNSUPPORTED', '这条记录缺少快照，无法撤销')
      task = restoreExistingTask(db, before, at)
      summary = `撤销${row.command.replace('task.', '')}「${before.title}」`
    }
    recordOp(db, {
      opId: newOpId(),
      ts: at,
      actor: context.actor ?? 'user',
      source: context.source ?? 'gui',
      command: 'history.undo',
      aggregateType: 'task',
      aggregateId: row.aggregate_id,
      summary,
      payload: { undoneCommand: row.command },
      before: after,
      after: task ?? { undone: true },
    })
    return { undone: true, command: row.command, task, summary }
  })
}
