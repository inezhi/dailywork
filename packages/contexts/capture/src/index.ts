import {
  OpError,
  type CreateMemoInput,
  type InboxCaptureInput,
  type ListMemosInput,
  type ListResult,
  type Memo,
  type MemoStats,
  type MemoToTaskInput,
  type UpdateMemoInput,
} from '@daily/contracts'
import {
  addDays,
  localDayBoundsUtc,
  newId,
  nowIso,
  todayLocal,
  toDateOnly,
  transaction,
  type Db,
} from '@daily/platform'
import { createTask, ensureTag } from '@daily/context-tasking'

interface MemoRow {
  id: string
  content: string
  tags_json: string
  pinned: number
  color: string
  converted_task_id: string | null
  created_at: string
  updated_at: string
}

function mapMemo(row: MemoRow): Memo {
  let tags: string[] = []
  try {
    tags = JSON.parse(row.tags_json) as string[]
  } catch {
    tags = []
  }
  return {
    id: row.id,
    content: row.content,
    tags,
    pinned: row.pinned === 1,
    color: row.color,
    convertedTaskId: row.converted_task_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const HASHTAG = /#([\p{L}\p{N}_-]{1,40})/gu

export function extractTags(content: string): string[] {
  const tags = new Set<string>()
  for (const match of content.matchAll(HASHTAG)) {
    if (match[1]) tags.add(match[1])
  }
  return [...tags]
}

function normalizeTags(content: string, tags?: string[]): string[] {
  const merged = new Set<string>([...(tags ?? []), ...extractTags(content)])
  return [...merged].map((t) => t.replace(/^#/, '').trim()).filter(Boolean).slice(0, 20)
}

export function createMemo(db: Db, input: CreateMemoInput): Memo {
  const at = nowIso()
  const id = newId('mem')
  const tags = normalizeTags(input.content, input.tags)
  db.prepare(
    `INSERT INTO memos(id, content, tags_json, pinned, color, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.content.trim(), JSON.stringify(tags), input.pinned ? 1 : 0, input.color ?? '#FAF9F5', at, at)
  return getMemo(db, id)
}

export function getMemo(db: Db, id: string): Memo {
  const row = db.prepare('SELECT * FROM memos WHERE id = ?').get(id) as MemoRow | undefined
  if (!row) throw new OpError('NOT_FOUND', '速记不存在')
  return mapMemo(row)
}

export function updateMemo(db: Db, input: UpdateMemoInput): Memo {
  const current = db.prepare('SELECT * FROM memos WHERE id = ?').get(input.id) as MemoRow | undefined
  if (!current) throw new OpError('NOT_FOUND', '速记不存在')
  const sets: string[] = []
  const values: Array<string | number> = []
  if (input.content !== undefined) {
    sets.push('content = ?')
    values.push(input.content.trim())
    const tags = normalizeTags(input.content, input.tags ?? mapMemo(current).tags)
    sets.push('tags_json = ?')
    values.push(JSON.stringify(tags))
  } else if (input.tags !== undefined) {
    sets.push('tags_json = ?')
    values.push(JSON.stringify(normalizeTags(current.content, input.tags)))
  }
  if (input.pinned !== undefined) {
    sets.push('pinned = ?')
    values.push(input.pinned ? 1 : 0)
  }
  if (input.color !== undefined) {
    sets.push('color = ?')
    values.push(input.color)
  }
  if (sets.length) {
    sets.push('updated_at = ?')
    values.push(nowIso())
    db.prepare(`UPDATE memos SET ${sets.join(', ')} WHERE id = ?`).run(...values, input.id)
  }
  return getMemo(db, input.id)
}

export function deleteMemo(db: Db, id: string): { id: string } {
  db.prepare('DELETE FROM memos WHERE id = ?').run(id)
  return { id }
}

export function listMemos(db: Db, input: ListMemosInput): ListResult<Memo> {
  const where: string[] = ['archived_at IS NULL']
  const params: Array<string | number> = []
  if (input.tag) {
    where.push('EXISTS (SELECT 1 FROM json_each(memos.tags_json) WHERE value = ?)')
    params.push(input.tag)
  }
  if (input.search) {
    where.push('content LIKE ?')
    params.push(`%${input.search}%`)
  }
  if (input.pinnedOnly) where.push('pinned = 1')
  if (input.from) {
    const bounds = localDayBoundsUtc(input.from)
    where.push('created_at >= ?')
    params.push(bounds.start)
  }
  if (input.to) {
    const bounds = localDayBoundsUtc(input.to)
    where.push('created_at < ?')
    params.push(bounds.end)
  }
  const whereSql = where.join(' AND ')
  const total = (
    db.prepare(`SELECT COUNT(*) AS c FROM memos WHERE ${whereSql}`).get(...params) as { c: number }
  ).c
  const rows = db
    .prepare(
      `SELECT * FROM memos WHERE ${whereSql}
       ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, input.limit, input.offset) as unknown as MemoRow[]
  return { items: rows.map(mapMemo), total }
}

export function memoStats(db: Db): MemoStats {
  const today = todayLocal()
  const bounds = localDayBoundsUtc(today)
  const total = (db.prepare('SELECT COUNT(*) AS c FROM memos WHERE archived_at IS NULL').get() as {
    c: number
  }).c
  const todayCount = (
    db
      .prepare('SELECT COUNT(*) AS c FROM memos WHERE archived_at IS NULL AND created_at >= ? AND created_at < ?')
      .get(bounds.start, bounds.end) as { c: number }
  ).c
  const tags = db
    .prepare(
      `SELECT value AS tag, COUNT(*) AS count FROM memos, json_each(memos.tags_json)
       WHERE memos.archived_at IS NULL GROUP BY value ORDER BY count DESC, tag LIMIT 30`,
    )
    .all() as Array<{ tag: string; count: number }>
  const days = db
    .prepare(
      `SELECT DISTINCT date(created_at, 'localtime') AS day FROM memos
       WHERE archived_at IS NULL ORDER BY day DESC LIMIT 400`,
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
  return { total, today: todayCount, tags, streakDays: streak }
}

export function memoToTask(
  db: Db,
  input: MemoToTaskInput,
): { memo: Memo; task: ReturnType<typeof createTask> } {
  return transaction(db, () => {
    const memo = getMemo(db, input.id)
    if (memo.convertedTaskId) {
      throw new OpError('CONFLICT', '速记已转为任务', { taskId: memo.convertedTaskId })
    }
    const firstLine = memo.content.split('\n')[0] ?? '速记'
    const fallbackTitle = firstLine.replace(HASHTAG, '').trim().slice(0, 120) || '速记'
    const title = input.title ?? fallbackTitle
    const tagIds = memo.tags.map((t) => ensureTag(db, t).id)
    const task = createTask(
      { db, actor: 'user', source: 'gui' },
      {
        title,
        notes: memo.content,
        projectId: input.projectId ?? undefined,
        scheduledDate: input.scheduledDate ?? undefined,
        tagIds,
      },
    )
    db.prepare('UPDATE memos SET converted_task_id = ?, updated_at = ? WHERE id = ?').run(
      task.id,
      nowIso(),
      memo.id,
    )
    return { memo: getMemo(db, memo.id), task }
  })
}

export function captureInbox(db: Db, input: InboxCaptureInput): { kind: 'memo' | 'task'; id: string } {
  if (input.kind === 'task') {
    const task = createTask(
      { db, actor: 'user', source: 'gui' },
      {
        title: input.content.trim().slice(0, 500),
        status: 'inbox',
        tagIds: (input.tags ?? []).map((t) => ensureTag(db, t).id),
      },
    )
    return { kind: 'task', id: task.id }
  }
  const memo = createMemo(db, { content: input.content, tags: input.tags })
  return { kind: 'memo', id: memo.id }
}

export function memoDayCounts(db: Db, days: number): Array<{ date: string; count: number }> {
  const rows = db
    .prepare(
      `SELECT date(created_at, 'localtime') AS date, COUNT(*) AS count FROM memos
       WHERE archived_at IS NULL GROUP BY date ORDER BY date DESC LIMIT ?`,
    )
    .all(days) as Array<{ date: string; count: number }>
  return rows
}

export function memoLocalDate(iso: string): string {
  return toDateOnly(new Date(iso))
}
