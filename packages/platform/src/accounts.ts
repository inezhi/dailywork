import { DatabaseSync } from 'node:sqlite'
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { OpError, type PublicUser } from '@daily/contracts'
import { newId } from './ids.js'
import { nowIso } from './time.js'

export interface AccountUserRow {
  id: string
  username: string
  password_hash: string
  password_salt: string
  avatar: Uint8Array | null
  avatar_mime: string | null
  created_at: string
  updated_at: string
}

export interface AccountSession {
  token: string
  user_id: string
  created_at: string
  expires_at: string
}

export type AccountsDb = DatabaseSync

const SESSION_DAYS = 30
const PASSWORD_KEYLEN = 64

export function openAccountsDb(dataDir: string): AccountsDb {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(join(dataDir, 'accounts.sqlite'))
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      avatar BLOB,
      avatar_mime TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  `)
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(nowIso())
  return db
}

export function countUsers(db: AccountsDb): number {
  return (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c
}

export function firstUser(db: AccountsDb): AccountUserRow | null {
  return (
    (db.prepare('SELECT * FROM users ORDER BY created_at LIMIT 1').get() as
      | AccountUserRow
      | undefined) ?? null
  )
}

export function getUserById(db: AccountsDb, id: string): AccountUserRow | null {
  return (
    (db.prepare('SELECT * FROM users WHERE id = ?').get(id) as AccountUserRow | undefined) ??
    null
  )
}

export function getUserByUsername(db: AccountsDb, username: string): AccountUserRow | null {
  return (
    (db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username) as
      | AccountUserRow
      | undefined) ?? null
  )
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, PASSWORD_KEYLEN).toString('hex')
}

export function verifyPassword(user: AccountUserRow, password: string): boolean {
  const candidate = Buffer.from(hashPassword(password, user.password_salt), 'hex')
  const expected = Buffer.from(user.password_hash, 'hex')
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

export function registerUser(
  db: AccountsDb,
  input: { username: string; password: string },
): AccountUserRow {
  const username = input.username.trim()
  if (getUserByUsername(db, username)) {
    throw new OpError('CONFLICT', '这个用户名已经被注册')
  }
  const id = newId('usr')
  const salt = randomBytes(16).toString('hex')
  const at = nowIso()
  db.prepare(
    `INSERT INTO users(id, username, password_hash, password_salt, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?)`,
  ).run(id, username, hashPassword(input.password, salt), salt, at, at)
  return getUserById(db, id)!
}

export function changePassword(
  db: AccountsDb,
  userId: string,
  currentPassword: string,
  newPassword: string,
): void {
  const user = getUserById(db, userId)
  if (!user) throw new OpError('NOT_FOUND', '账户不存在')
  if (!verifyPassword(user, currentPassword)) {
    throw new OpError('UNAUTHORIZED', '当前密码不正确')
  }
  const salt = randomBytes(16).toString('hex')
  db.prepare(
    'UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?',
  ).run(hashPassword(newPassword, salt), salt, nowIso(), userId)
}

export function createSession(db: AccountsDb, userId: string): string {
  const token = randomBytes(32).toString('base64url')
  const created = new Date()
  const expires = new Date(created.getTime() + SESSION_DAYS * 86_400_000)
  db.prepare(
    'INSERT INTO sessions(token, user_id, created_at, expires_at) VALUES(?, ?, ?, ?)',
  ).run(token, userId, created.toISOString(), expires.toISOString())
  return token
}

export function getSessionUser(db: AccountsDb, token: string): AccountUserRow | null {
  if (!token) return null
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, nowIso()) as AccountUserRow | undefined
  if (!row) return null
  return row
}

export function deleteSession(db: AccountsDb, token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

export function deleteOtherSessions(db: AccountsDb, userId: string, keepToken?: string): void {
  if (keepToken) {
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(userId, keepToken)
  } else {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
  }
}

export function setAvatar(
  db: AccountsDb,
  userId: string,
  data: Uint8Array,
  mime: string,
): AccountUserRow {
  db.prepare('UPDATE users SET avatar = ?, avatar_mime = ?, updated_at = ? WHERE id = ?').run(
    data,
    mime,
    nowIso(),
    userId,
  )
  return getUserById(db, userId)!
}

export function clearAvatar(db: AccountsDb, userId: string): AccountUserRow {
  db.prepare('UPDATE users SET avatar = NULL, avatar_mime = NULL, updated_at = ? WHERE id = ?').run(
    nowIso(),
    userId,
  )
  return getUserById(db, userId)!
}

export function getAvatar(
  db: AccountsDb,
  userId: string,
): { data: Uint8Array; mime: string } | null {
  const row = db
    .prepare('SELECT avatar, avatar_mime FROM users WHERE id = ?')
    .get(userId) as { avatar: Uint8Array | null; avatar_mime: string | null } | undefined
  if (!row?.avatar || !row.avatar_mime) return null
  return { data: row.avatar, mime: row.avatar_mime }
}

export function userAvatarUrl(user: AccountUserRow): string | null {
  if (!user.avatar) return null
  const version = encodeURIComponent(createHash('sha1').update(user.updated_at).digest('hex').slice(0, 8))
  return `/api/auth/avatar/${user.id}?v=${version}`
}

export function toPublicUser(user: AccountUserRow): PublicUser {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: userAvatarUrl(user),
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  }
}

export function userDatabasePath(dataDir: string, userId: string): string {
  return join(dataDir, 'users', userId, 'data.sqlite')
}
