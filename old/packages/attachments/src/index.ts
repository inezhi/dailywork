import { createHash } from 'node:crypto'
import { extname } from 'node:path'
import { OpError, type Attachment, type OwnerType } from '@daily/contracts'
import { newId, nowIso, transaction, type Db } from '@daily/platform'

const MAX_BYTES = 20 * 1024 * 1024
const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
])

interface AttachmentRow {
  id: string
  owner_type: string
  owner_id: string
  filename: string
  sort_order: number
  created_at: string
  mime: string
  bytes: number
  width: number | null
  height: number | null
  thumb_data: Uint8Array | null
}

function mapAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    ownerType: row.owner_type as OwnerType,
    ownerId: row.owner_id,
    filename: row.filename,
    mime: row.mime,
    size: row.bytes,
    width: row.width,
    height: row.height,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    url: `/api/attachments/${row.id}/content`,
    thumbUrl: row.thumb_data ? `/api/attachments/${row.id}/thumb` : null,
  }
}

const ATTACHMENT_SELECT = `
  SELECT a.id, a.owner_type, a.owner_id, a.filename, a.sort_order, a.created_at,
         b.mime, b.bytes, b.width, b.height, b.thumb_data
  FROM attachments a JOIN blobs b ON b.id = a.blob_id
`

function ensureOwner(db: Db, ownerType: OwnerType, ownerId: string): void {
  const table = ownerType === 'task' ? 'tasks' : ownerType === 'document' ? 'documents' : 'memos'
  const exists = db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(ownerId)
  if (!exists) throw new OpError('NOT_FOUND', '附件所属对象不存在')
}

export function listAttachments(db: Db, ownerType: OwnerType, ownerId: string): Attachment[] {
  const rows = db
    .prepare(`${ATTACHMENT_SELECT} WHERE a.owner_type = ? AND a.owner_id = ? ORDER BY a.sort_order, a.created_at`)
    .all(ownerType, ownerId) as unknown as AttachmentRow[]
  return rows.map(mapAttachment)
}

export interface SaveAttachmentInput {
  ownerType: OwnerType
  ownerId: string
  filename: string
  mime: string
  data: Uint8Array
  thumbData?: Uint8Array | null
  width?: number | null
  height?: number | null
}

function safeName(filename: string): string {
  const base = filename.replace(/[\\/]/g, '_').replace(/^\.+/, '').trim()
  return (base || `attachment${extname(filename)}`).slice(0, 200)
}

export function saveAttachment(db: Db, input: SaveAttachmentInput): Attachment {
  if (!ALLOWED.has(input.mime)) {
    throw new OpError('BAD_REQUEST', '仅支持 PNG / JPEG / WebP / GIF / PDF 附件')
  }
  if (input.data.byteLength === 0) throw new OpError('BAD_REQUEST', '附件内容为空')
  if (input.data.byteLength > MAX_BYTES) throw new OpError('BAD_REQUEST', '附件不能超过 20MB')
  ensureOwner(db, input.ownerType, input.ownerId)

  return transaction(db, () => {
    const sha256 = createHash('sha256').update(input.data).digest('hex')
    const at = nowIso()
    let blob = db.prepare('SELECT id FROM blobs WHERE sha256 = ?').get(sha256) as
      | { id: string }
      | undefined
    if (!blob) {
      const blobId = newId('blb')
      db.prepare(
        `INSERT INTO blobs(id, sha256, mime, bytes, width, height, data, thumb_data, ref_count, created_at)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      ).run(
        blobId,
        sha256,
        input.mime,
        input.data.byteLength,
        input.width ?? null,
        input.height ?? null,
        input.data,
        input.thumbData ?? null,
        at,
      )
      blob = { id: blobId }
    }
    const max = db
      .prepare(
        'SELECT COALESCE(MAX(sort_order), 0) AS m FROM attachments WHERE owner_type = ? AND owner_id = ?',
      )
      .get(input.ownerType, input.ownerId) as { m: number }
    const id = newId('att')
    db.prepare(
      `INSERT INTO attachments(id, owner_type, owner_id, blob_id, filename, sort_order, created_at)
       VALUES(?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, input.ownerType, input.ownerId, blob.id, safeName(input.filename), max.m + 1, at)
    db.prepare('UPDATE blobs SET ref_count = ref_count + 1 WHERE id = ?').run(blob.id)
    const row = db.prepare(`${ATTACHMENT_SELECT} WHERE a.id = ?`).get(id) as unknown as AttachmentRow
    return mapAttachment(row)
  })
}

export function deleteAttachment(db: Db, id: string): { id: string } {
  return transaction(db, () => {
    const row = db
      .prepare('SELECT blob_id FROM attachments WHERE id = ?')
      .get(id) as { blob_id: string } | undefined
    if (!row) return { id }
    db.prepare('DELETE FROM attachments WHERE id = ?').run(id)
    db.prepare('UPDATE blobs SET ref_count = ref_count - 1 WHERE id = ?').run(row.blob_id)
    const count = db.prepare('SELECT ref_count FROM blobs WHERE id = ?').get(row.blob_id) as
      | { ref_count: number }
      | undefined
    if (!count || count.ref_count <= 0) {
      db.prepare('DELETE FROM blobs WHERE id = ?').run(row.blob_id)
    }
    return { id }
  })
}

export interface AttachmentContent {
  data: Uint8Array
  mime: string
  filename: string
  thumb: boolean
}

export function getAttachmentContent(db: Db, id: string, thumb = false): AttachmentContent {
  const row = db
    .prepare(
      `SELECT a.filename, b.mime, b.data, b.thumb_data FROM attachments a
       JOIN blobs b ON b.id = a.blob_id WHERE a.id = ?`,
    )
    .get(id) as
    | { filename: string; mime: string; data: Uint8Array; thumb_data: Uint8Array | null }
    | undefined
  if (!row) throw new OpError('NOT_FOUND', '附件不存在')
  if (thumb && row.thumb_data) {
    return { data: row.thumb_data, mime: 'image/webp', filename: row.filename, thumb: true }
  }
  return { data: row.data, mime: row.mime, filename: row.filename, thumb: false }
}

export function attachmentStats(db: Db): { count: number; bytes: number } {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(bytes),0) AS bytes FROM blobs WHERE ref_count > 0`,
    )
    .get() as { count: number; bytes: number }
  return row
}
