import {
  OpError,
  type CreateDocumentInput,
  type Document,
  type DocumentBody,
  type ListDocumentsInput,
  type SaveDocumentBodyInput,
  type UpdateDocumentInput,
} from '@daily/contracts'
import { newId, nowIso, transaction, type Db } from '@daily/platform'

interface DocumentRow {
  id: string
  parent_id: string | null
  space_id: string | null
  project_id: string | null
  task_id: string | null
  title: string
  icon: string
  excerpt: string
  sort_order: number
  archived_at: string | null
  created_at: string
  updated_at: string
  child_count?: number
}

function mapDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    parentId: row.parent_id,
    spaceId: row.space_id,
    projectId: row.project_id,
    taskId: row.task_id,
    title: row.title,
    icon: row.icon,
    excerpt: row.excerpt,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    childCount: row.child_count ?? 0,
  }
}

const DOC_SELECT = `
  SELECT d.*,
    (SELECT COUNT(*) FROM documents c WHERE c.parent_id = d.id AND c.archived_at IS NULL) AS child_count
  FROM documents d
`

export const EMPTY_DOC_CONTENT = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

export function extractText(content: unknown): string {
  const parts: string[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const obj = node as Record<string, unknown>
    if (obj.type === 'text' && typeof obj.text === 'string') parts.push(obj.text)
    if (Array.isArray(obj.content)) for (const child of obj.content) walk(child)
    if (obj.type === 'paragraph' || obj.type === 'heading' || obj.type === 'listItem') parts.push(' ')
  }
  walk(content)
  return parts.join('').replace(/\s+/g, ' ').trim()
}

const LINK_PATTERN = /(task|project|document):\/\/([a-zA-Z0-9_-]{1,64})/g

export function extractLinks(content: unknown): Array<{ targetType: string; targetId: string }> {
  const raw = JSON.stringify(content)
  const out = new Map<string, { targetType: string; targetId: string }>()
  for (const match of raw.matchAll(LINK_PATTERN)) {
    if (match[1] && match[2]) {
      out.set(`${match[1]}:${match[2]}`, { targetType: match[1], targetId: match[2] })
    }
  }
  return [...out.values()]
}

export function listDocuments(db: Db, input: ListDocumentsInput = {}): Document[] {
  const where: string[] = [input.includeArchived ? '1=1' : 'd.archived_at IS NULL']
  const params: string[] = []
  if (input.spaceId) {
    where.push('d.space_id = ?')
    params.push(input.spaceId)
  }
  if (input.projectId) {
    where.push('d.project_id = ?')
    params.push(input.projectId)
  }
  if (input.taskId) {
    where.push('d.task_id = ?')
    params.push(input.taskId)
  }
  if (input.parentId) {
    where.push('d.parent_id = ?')
    params.push(input.parentId)
  }
  if (input.search) {
    where.push(
      '(d.title LIKE ? OR d.excerpt LIKE ? OR EXISTS (SELECT 1 FROM document_bodies b WHERE b.document_id = d.id AND b.text LIKE ?))',
    )
    params.push(`%${input.search}%`, `%${input.search}%`, `%${input.search}%`)
  }
  const rows = db
    .prepare(`${DOC_SELECT} WHERE ${where.join(' AND ')} ORDER BY d.sort_order, d.created_at`)
    .all(...params) as unknown as DocumentRow[]
  return rows.map(mapDocument)
}

export function getDocument(db: Db, id: string): Document {
  const row = db.prepare(`${DOC_SELECT} WHERE d.id = ?`).get(id) as DocumentRow | undefined
  if (!row) throw new OpError('NOT_FOUND', '文档不存在')
  return mapDocument(row)
}

export function getBody(db: Db, documentId: string): DocumentBody {
  const row = db
    .prepare('SELECT * FROM document_bodies WHERE document_id = ?')
    .get(documentId) as
    | { document_id: string; content_json: string; text: string; updated_at: string }
    | undefined
  if (!row) {
    return {
      documentId,
      content: EMPTY_DOC_CONTENT,
      text: '',
      updatedAt: nowIso(),
    }
  }
  let content: unknown = EMPTY_DOC_CONTENT
  try {
    content = JSON.parse(row.content_json)
  } catch {
    content = EMPTY_DOC_CONTENT
  }
  return {
    documentId,
    content,
    text: row.text,
    updatedAt: row.updated_at,
  }
}

export function getDocumentDetail(
  db: Db,
  id: string,
): { document: Document; body: DocumentBody; backlinks: Document[] } {
  const document = getDocument(db, id)
  const backlinks = db
    .prepare(
      `${DOC_SELECT} WHERE d.archived_at IS NULL AND d.id IN
       (SELECT document_id FROM document_links WHERE target_type = 'document' AND target_id = ?)
       ORDER BY d.updated_at DESC`,
    )
    .all(id) as unknown as DocumentRow[]
  return { document, body: getBody(db, id), backlinks: backlinks.map(mapDocument) }
}

export function createDocument(db: Db, input: CreateDocumentInput): Document {
  const at = nowIso()
  const id = newId('doc')
  const parentId = input.parentId ?? null
  if (parentId) getDocument(db, parentId)
  const max = db
    .prepare(
      `SELECT COALESCE(MAX(sort_order), 0) AS m FROM documents
       WHERE ${parentId ? 'parent_id = ?' : 'parent_id IS NULL'}`,
    )
    .get(...(parentId ? [parentId] : [])) as { m: number }
  const content = input.content ?? EMPTY_DOC_CONTENT
  const text = extractText(content)
  const excerpt = text.slice(0, 160)
  const title = input.title?.trim() || '未命名文档'
  transaction(db, () => {
    db.prepare(
      `INSERT INTO documents(id, parent_id, space_id, project_id, task_id, title, icon, excerpt,
        sort_order, created_at, updated_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      parentId,
      input.spaceId ?? null,
      input.projectId ?? null,
      input.taskId ?? null,
      title,
      input.icon ?? 'file-text',
      excerpt,
      max.m + 1,
      at,
      at,
    )
    db.prepare(
      'INSERT INTO document_bodies(document_id, content_json, text, updated_at) VALUES(?, ?, ?, ?)',
    ).run(id, JSON.stringify(content), text, at)
    syncLinks(db, id, content)
  })
  return getDocument(db, id)
}

export function updateDocument(db: Db, input: UpdateDocumentInput): Document {
  const current = db.prepare('SELECT * FROM documents WHERE id = ?').get(input.id) as
    | DocumentRow
    | undefined
  if (!current) throw new OpError('NOT_FOUND', '文档不存在')
  if (input.parentId && input.parentId === input.id) {
    throw new OpError('BAD_REQUEST', '文档不能作为自己的子文档')
  }
  const sets: string[] = []
  const values: Array<string | number | null> = []
  const set = (col: string, val: string | number | null) => {
    sets.push(`${col} = ?`)
    values.push(val)
  }
  if (input.title !== undefined) set('title', input.title.trim() || '未命名文档')
  if (input.icon !== undefined) set('icon', input.icon)
  if (input.parentId !== undefined) set('parent_id', input.parentId ?? null)
  if (input.spaceId !== undefined) set('space_id', input.spaceId ?? null)
  if (input.projectId !== undefined) set('project_id', input.projectId ?? null)
  if (input.taskId !== undefined) set('task_id', input.taskId ?? null)
  if (input.sortOrder !== undefined) set('sort_order', input.sortOrder)
  if (sets.length) {
    sets.push('updated_at = ?')
    values.push(nowIso())
    db.prepare(`UPDATE documents SET ${sets.join(', ')} WHERE id = ?`).run(...values, input.id)
  }
  return getDocument(db, input.id)
}

export function saveBody(db: Db, input: SaveDocumentBodyInput): DocumentBody {
  const document = getDocument(db, input.id)
  const text = input.text ?? extractText(input.content)
  const excerpt = text.slice(0, 160)
  const at = nowIso()
  transaction(db, () => {
    db.prepare(
      `INSERT INTO document_bodies(document_id, content_json, text, updated_at) VALUES(?, ?, ?, ?)
       ON CONFLICT(document_id) DO UPDATE SET content_json = excluded.content_json,
         text = excluded.text, updated_at = excluded.updated_at`,
    ).run(input.id, JSON.stringify(input.content), text, at)
    let title = document.title
    if ((title === '未命名文档' || title.trim() === '') && text.trim()) {
      title = text.trim().split('\n')[0]!.slice(0, 80)
    }
    db.prepare('UPDATE documents SET excerpt = ?, title = ?, updated_at = ? WHERE id = ?').run(
      excerpt,
      title,
      at,
      input.id,
    )
    syncLinks(db, input.id, input.content)
  })
  return getBody(db, input.id)
}

function syncLinks(db: Db, documentId: string, content: unknown): void {
  db.prepare('DELETE FROM document_links WHERE document_id = ? AND target_type != ?').run(
    documentId,
    'document',
  )
  db.prepare('DELETE FROM document_links WHERE document_id = ?').run(documentId)
  for (const link of extractLinks(content)) {
    db.prepare(
      'INSERT OR IGNORE INTO document_links(document_id, target_type, target_id) VALUES(?, ?, ?)',
    ).run(documentId, link.targetType, link.targetId)
  }
}

export function deleteDocument(db: Db, id: string): { id: string } {
  db.prepare('DELETE FROM documents WHERE id = ?').run(id)
  return { id }
}

export function archiveDocument(db: Db, id: string): Document {
  db.prepare('UPDATE documents SET archived_at = ?, updated_at = ? WHERE id = ?').run(
    nowIso(),
    nowIso(),
    id,
  )
  return getDocument(db, id)
}

export function documentAuxCounts(db: Db, id: string): { backlinks: number; children: number } {
  const backlinks = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM document_links WHERE target_type = 'document' AND target_id = ?`,
      )
      .get(id) as { c: number }
  ).c
  const children = (
    db
      .prepare('SELECT COUNT(*) AS c FROM documents WHERE parent_id = ? AND archived_at IS NULL')
      .get(id) as { c: number }
  ).c
  return { backlinks, children }
}

export function searchDocuments(db: Db, query: string, limit = 10): Document[] {
  const q = `%${query}%`
  const rows = db
    .prepare(
      `${DOC_SELECT} WHERE d.archived_at IS NULL AND
        (d.title LIKE ? OR d.excerpt LIKE ? OR EXISTS
          (SELECT 1 FROM document_bodies b WHERE b.document_id = d.id AND b.text LIKE ?))
       ORDER BY d.updated_at DESC LIMIT ?`,
    )
    .all(q, q, q, limit) as unknown as DocumentRow[]
  return rows.map(mapDocument)
}

export function documentsForTask(db: Db, taskId: string): Document[] {
  const rows = db
    .prepare(`${DOC_SELECT} WHERE d.task_id = ? AND d.archived_at IS NULL ORDER BY d.updated_at DESC`)
    .all(taskId) as unknown as DocumentRow[]
  return rows.map(mapDocument)
}
