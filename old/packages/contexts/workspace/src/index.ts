import {
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_THEME_SETTINGS,
  OpError,
  type CreateSpaceInput,
  type GeneralSettings,
  type Settings,
  type Space,
  type ThemeSettings,
  type UpdateSettingsInput,
  type UpdateSpaceInput,
} from '@daily/contracts'
import { getSetting, newId, nowIso, setSetting, type Db } from '@daily/platform'

interface SpaceRow {
  id: string
  name: string
  color: string
  icon: string
  sort_order: number
  archived_at: string | null
  created_at: string
  updated_at: string
  project_count?: number
  open_task_count?: number
}

function mapSpace(row: SpaceRow): Space {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    projectCount: row.project_count ?? 0,
    openTaskCount: row.open_task_count ?? 0,
  }
}

export function listSpaces(db: Db, includeArchived = false): Space[] {
  const rows = db
    .prepare(
      `SELECT sp.*,
        (SELECT COUNT(*) FROM projects p WHERE p.space_id = sp.id AND p.archived_at IS NULL) AS project_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.space_id = sp.id AND t.archived_at IS NULL
          AND t.status != 'done' AND t.parent_id IS NULL) AS open_task_count
       FROM spaces sp
       ${includeArchived ? '' : 'WHERE sp.archived_at IS NULL'}
       ORDER BY sp.sort_order, sp.created_at`,
    )
    .all() as unknown as SpaceRow[]
  return rows.map(mapSpace)
}

export function getSpace(db: Db, id: string): Space {
  const row = db.prepare('SELECT * FROM spaces WHERE id = ?').get(id) as SpaceRow | undefined
  if (!row) throw new OpError('NOT_FOUND', '空间不存在')
  return mapSpace(row)
}

export function createSpace(db: Db, input: CreateSpaceInput): Space {
  const at = nowIso()
  const id = newId('spc')
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM spaces').get() as {
    m: number
  }
  db.prepare(
    `INSERT INTO spaces(id, name, color, icon, sort_order, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.name.trim(), input.color ?? '#1677FF', input.icon ?? 'layers', max.m + 1, at, at)
  return getSpace(db, id)
}

export function updateSpace(db: Db, input: UpdateSpaceInput): Space {
  const current = db.prepare('SELECT * FROM spaces WHERE id = ?').get(input.id) as
    | SpaceRow
    | undefined
  if (!current) throw new OpError('NOT_FOUND', '空间不存在')
  if (input.name !== undefined && input.name.trim() !== current.name) {
    db.prepare('UPDATE spaces SET name = ?, updated_at = ? WHERE id = ?').run(
      input.name.trim(),
      nowIso(),
      input.id,
    )
  }
  if (input.color !== undefined) {
    db.prepare('UPDATE spaces SET color = ?, updated_at = ? WHERE id = ?').run(
      input.color,
      nowIso(),
      input.id,
    )
  }
  if (input.icon !== undefined) {
    db.prepare('UPDATE spaces SET icon = ?, updated_at = ? WHERE id = ?').run(
      input.icon,
      nowIso(),
      input.id,
    )
  }
  if (input.archived !== undefined) {
    db.prepare('UPDATE spaces SET archived_at = ?, updated_at = ? WHERE id = ?').run(
      input.archived ? nowIso() : null,
      nowIso(),
      input.id,
    )
  }
  return getSpace(db, input.id)
}

export function getSettings(db: Db): Settings {
  return {
    theme: { ...DEFAULT_THEME_SETTINGS, ...getSetting<Partial<ThemeSettings>>(db, 'theme', {}) },
    general: {
      ...DEFAULT_GENERAL_SETTINGS,
      ...getSetting<Partial<GeneralSettings>>(db, 'general', {}),
    },
  }
}

export function updateSettings(db: Db, input: UpdateSettingsInput): Settings {
  const at = nowIso()
  const current = getSettings(db)
  const next: Settings = {
    theme: { ...current.theme, ...(input.theme ?? {}) },
    general: { ...current.general, ...(input.general ?? {}) },
  }
  if (input.theme) setSetting(db, 'theme', next.theme, at)
  if (input.general) setSetting(db, 'general', next.general, at)
  return next
}

export function getDefaultSpaceId(db: Db): string {
  const row = db
    .prepare('SELECT id FROM spaces WHERE archived_at IS NULL ORDER BY sort_order LIMIT 1')
    .get() as { id: string } | undefined
  if (!row) throw new OpError('NOT_FOUND', '没有可用的空间')
  return row.id
}
