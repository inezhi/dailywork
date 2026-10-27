import { OpError, type Tag } from '@daily/contracts'
import { newId, nowIso, type Db } from '@daily/platform'

export interface TagWithCount extends Tag {
  taskCount: number
}

export function listTags(db: Db): TagWithCount[] {
  const rows = db
    .prepare(
      `SELECT tg.id, tg.name, tg.color, tg.created_at,
              (SELECT COUNT(*) FROM task_tags tt JOIN tasks t ON t.id = tt.task_id
               WHERE tt.tag_id = tg.id AND t.archived_at IS NULL) AS task_count
       FROM tags tg ORDER BY tg.name COLLATE NOCASE`,
    )
    .all() as Array<{
    id: string
    name: string
    color: string
    created_at: string
    task_count: number
  }>
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    createdAt: r.created_at,
    taskCount: r.task_count,
  }))
}

export function createTag(
  db: Db,
  input: { name: string; color?: string },
): TagWithCount {
  const name = input.name.trim()
  const existing = db
    .prepare('SELECT id, name, color, created_at FROM tags WHERE name = ? COLLATE NOCASE')
    .get(name) as { id: string; name: string; color: string; created_at: string } | undefined
  if (existing) {
    return { ...toTag(existing), taskCount: 0 }
  }
  const id = newId('tag')
  db.prepare('INSERT INTO tags(id, name, color, created_at) VALUES(?, ?, ?, ?)').run(
    id,
    name,
    input.color ?? '#8A857D',
    nowIso(),
  )
  const created = db
    .prepare('SELECT id, name, color, created_at FROM tags WHERE id = ?')
    .get(id) as { id: string; name: string; color: string; created_at: string }
  return { ...toTag(created), taskCount: 0 }
}

export function updateTag(
  db: Db,
  input: { id: string; name?: string; color?: string },
): TagWithCount {
  const current = db
    .prepare('SELECT id, name, color, created_at FROM tags WHERE id = ?')
    .get(input.id) as { id: string; name: string; color: string; created_at: string } | undefined
  if (!current) throw new OpError('NOT_FOUND', '标签不存在')
  if (input.name !== undefined) {
    const clash = db
      .prepare('SELECT 1 FROM tags WHERE name = ? COLLATE NOCASE AND id != ?')
      .get(input.name, input.id)
    if (clash) throw new OpError('CONFLICT', '标签名称已存在')
    db.prepare('UPDATE tags SET name = ? WHERE id = ?').run(input.name.trim(), input.id)
  }
  if (input.color !== undefined) {
    db.prepare('UPDATE tags SET color = ? WHERE id = ?').run(input.color, input.id)
  }
  const updated = db
    .prepare('SELECT id, name, color, created_at FROM tags WHERE id = ?')
    .get(input.id) as { id: string; name: string; color: string; created_at: string }
  return { ...toTag(updated), taskCount: 0 }
}

export function deleteTag(db: Db, id: string): { id: string } {
  db.prepare('DELETE FROM tags WHERE id = ?').run(id)
  return { id }
}

export function ensureTag(db: Db, name: string): Tag {
  const existing = db
    .prepare('SELECT id, name, color, created_at FROM tags WHERE name = ? COLLATE NOCASE')
    .get(name) as { id: string; name: string; color: string; created_at: string } | undefined
  if (existing) return toTag(existing)
  const created = createTag(db, { name })
  return { id: created.id, name: created.name, color: created.color, createdAt: created.createdAt }
}

function toTag(row: {
  id: string
  name: string
  color: string
  created_at: string
}): Tag {
  return { id: row.id, name: row.name, color: row.color, createdAt: row.created_at }
}
