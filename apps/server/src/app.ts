import { Hono } from 'hono'
import { getRequestListener } from '@hono/node-server'
import { createServer as createHttpsServer } from 'node:https'
import { streamSSE } from 'hono/streaming'
import { serve } from '@hono/node-server'
import { readFile } from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import type { Server } from 'node:http'
import {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  OpError,
  type Actor,
  type OpDescriptorMeta,
} from '@daily/contracts'
import {
  changePassword,
  clearAvatar,
  countUsers,
  createLogger,
  createSession,
  dataPaths,
  deleteOtherSessions,
  deleteSession,
  ensureDataDirs,
  firstUser,
  getAvatar,
  getSessionUser,
  getUserByUsername,
  openAccountsDb,
  openDatabase,
  registerUser,
  setAvatar,
  toPublicUser,
  userDatabasePath,
  verifyPassword,
  type AccountUserRow,
  type AccountsDb,
  type Db,
  type Logger,
} from '@daily/platform'
import { allOps, getOp, listOpsMeta, opMeta, runAssistantChat, runOp, type OpContext } from '@daily/ops'
import { getAttachmentContent, saveAttachment } from '@daily/attachments'
import { ChatInput, OwnerType } from '@daily/contracts'
import { getSettings } from '@daily/context-workspace'

export interface AppOptions {
  dataDir: string
  version?: string
  webDist?: string
  logger?: Logger
  token?: string
  port?: number
  host?: string
  pairingCode?: string
}

export interface AppBundle {
  app: Hono<any>
  db: Db
  token: string
  sseClients: Set<ReadableStreamDefaultController<Uint8Array>>
  closeDb: () => void
  setPort: (port: number) => void
  setHttpsPort: (port: number) => void
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

function actorFrom(headers: Headers): { actor: Actor; source: string } {
  const source = headers.get('x-daily-source') ?? 'api'
  const raw = headers.get('x-daily-actor') ?? 'user'
  const actor: Actor =
    raw === 'cli' || raw === 'ai' || raw === 'system' ? raw : 'user'
  return { actor, source }
}

interface AppEnv {
  Variables: {
    db: Db
    user: AccountUserRow | null
    sessionToken: string | null
    isBootstrap: boolean
    isOwner: boolean
  }
}

function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith(`${name}=`)) return trimmed.slice(name.length + 1)
  }
  return null
}

function sessionCookie(token: string, secure: boolean): string {
  return `daily_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${secure ? '; Secure' : ''}`
}

function remoteAddress(c: any): string {
  return c.env?.incoming?.socket?.remoteAddress ?? '127.0.0.1'
}

function isLoopback(remote: string): boolean {
  return remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1'
}

export function createApp(options: AppOptions): AppBundle {
  const paths = dataPaths(options.dataDir)
  ensureDataDirs(paths)
  const logger = options.logger ?? createLogger(paths, process.env.NODE_ENV === 'test' ? 'silent' : undefined)
  const rootDb = openDatabase(paths.dbFile)
  const accountsDb: AccountsDb = openAccountsDb(paths.dataDir)
  const userDbs = new Map<string, Db>()
  const getUserDb = (userId: string): Db => {
    const cached = userDbs.get(userId)
    if (cached) return cached
    const file = userDatabasePath(paths.dataDir, userId)
    const db = openDatabase(file)
    userDbs.set(userId, db)
    return db
  }
  const token = options.token ?? ''
  const version = options.version ?? '0.2.0'
  const sseClients = new Set<ReadableStreamDefaultController<Uint8Array>>()
  const encoder = new TextEncoder()

  const broadcast = (payload: unknown) => {
    const chunk = encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
    for (const client of sseClients) {
      try {
        client.enqueue(chunk)
      } catch {
        sseClients.delete(client)
      }
    }
  }

  const app = new Hono<AppEnv>()

  let actualPort = options.port ?? 0
  let actualHttpsPort = 0

  const pairingAttempts = new Map<string, { count: number; resetAt: number }>()

  app.use('/api/*', async (c, next) => {
    const startedAt = Date.now()
    const path = c.req.path
    const remote = remoteAddress(c)
    const loopback = isLoopback(remote)
    const publicPath =
      path === '/api/health' ||
      path === '/api/pair' ||
      path === '/api/auth/status' ||
      path === '/api/auth/login' ||
      path === '/api/auth/register' ||
      path === '/api/auth/me'

    if ((path === '/api/auth/register' || path === '/api/auth/login') && !loopback) {
      return c.json(
        {
          ok: false,
          error: { code: 'UNAUTHORIZED', message: '请先在 Mac 上登录，再从局域网配对' },
          meta: { opId: '', version: 1 },
        },
        403,
      )
    }

    const sessionToken = cookieValue(c.req.header('cookie'), 'daily_session')
    let user = sessionToken ? getSessionUser(accountsDb, sessionToken) : null
    let isOwner = false
    const auth = c.req.header('authorization') ?? ''
    if (!user && loopback && token && auth === `Bearer ${token}`) {
      user = firstUser(accountsDb)
      isOwner = Boolean(user)
    }

    c.set('sessionToken', sessionToken)
    c.set('user', user)
    c.set('isOwner', isOwner)
    c.set('isBootstrap', false)
    c.set('db', rootDb)

    if (user) {
      const db = getUserDb(user.id)
      c.set('db', db)
      if (!loopback) {
        if (!getSettings(db).general.lanEnabled) {
          return c.json(
            {
              ok: false,
              error: { code: 'UNAUTHORIZED', message: '局域网访问未启用，请在设置中打开' },
              meta: { opId: '', version: 1 },
            },
            403,
          )
        }
      }
    } else {
      const hasUsers = countUsers(accountsDb) > 0
      if (!hasUsers && loopback) {
        c.set('isBootstrap', true)
      } else if (!publicPath) {
        return c.json(
          {
            ok: false,
            error: { code: 'UNAUTHORIZED', message: '请先登录' },
            meta: { opId: '', version: 1 },
          },
          401,
        )
      }
    }

    await next()
    logger.info(
      {
        method: c.req.method,
        path,
        status: c.res.status,
        ms: Date.now() - startedAt,
      },
      'http',
    )
  })

  app.get('/pair', (c) => c.html(pairPage()))

  app.post('/api/pair', async (c) => {
    const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)
      ?.incoming
    const remote = incoming?.socket?.remoteAddress ?? 'unknown'
    const now = Date.now()
    const record = pairingAttempts.get(remote)
    if (record && record.resetAt > now && record.count >= 10) {
      return c.json({ ok: false, error: { message: '尝试过于频繁，请十分钟后再试' } }, 429)
    }
    if (!record || record.resetAt <= now) {
      pairingAttempts.set(remote, { count: 1, resetAt: now + 10 * 60_000 })
    } else {
      record.count++
    }
    let code = ''
    try {
      const body = (await c.req.json()) as { code?: string }
      code = String(body.code ?? '')
    } catch {
      code = ''
    }
    if (!options.pairingCode || code !== options.pairingCode) {
      return c.json({ ok: false, error: { message: '配对码不正确' } }, 401)
    }
    const owner = firstUser(accountsDb)
    if (!owner) {
      return c.json(
        { ok: false, error: { message: '请先在 Mac 上注册账户，再进行配对' } },
        409,
      )
    }
    if (!getSettings(getUserDb(owner.id)).general.lanEnabled) {
      return c.json({ ok: false, error: { message: '请先在 Mac 设置中开启局域网访问' } }, 403)
    }
    const session = createSession(accountsDb, owner.id)
    const secure = c.req.url.startsWith('https://')
    c.header('set-cookie', sessionCookie(session, secure))
    return c.json({ ok: true })
  })

  app.get('/api/auth/status', (c) =>
    c.json({ ok: true, data: { hasUsers: countUsers(accountsDb) > 0 } }),
  )

  app.post('/api/auth/register', async (c) => {
    let body: unknown = {}
    try {
      body = await c.req.json()
    } catch {
      body = {}
    }
    const parsed = RegisterInput.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? '输入不合法',
            details: parsed.error.issues,
          },
        },
        422,
      )
    }
    const first = countUsers(accountsDb) === 0
    let user: AccountUserRow
    try {
      user = registerUser(accountsDb, parsed.data)
    } catch (error) {
      if (error instanceof OpError) {
        return c.json({ ok: false, error: { code: error.code, message: error.message } }, 409)
      }
      return c.json({ ok: false, error: { code: 'INTERNAL', message: '注册失败' } }, 500)
    }
    const userFile = userDatabasePath(paths.dataDir, user.id)
    mkdirSync(join(paths.dataDir, 'users', user.id), { recursive: true, mode: 0o700 })
    if (first) {
      try {
        rootDb.exec(`VACUUM INTO '${userFile.replaceAll("'", "''")}'`)
      } catch (error) {
        logger.warn({ error }, 'legacy data copy failed; using a fresh workspace')
      }
    }
    getUserDb(user.id)
    const session = createSession(accountsDb, user.id)
    const secure = c.req.url.startsWith('https://')
    c.header('set-cookie', sessionCookie(session, secure))
    return c.json({ ok: true, data: { user: toPublicUser(user) } })
  })

  app.post('/api/auth/login', async (c) => {
    let body: unknown = {}
    try {
      body = await c.req.json()
    } catch {
      body = {}
    }
    const parsed = LoginInput.safeParse(body)
    if (!parsed.success) {
      return c.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: '请输入用户名和密码' } }, 422)
    }
    const user = getUserByUsername(accountsDb, parsed.data.username)
    if (!user || !verifyPassword(user, parsed.data.password)) {
      return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: '用户名或密码不正确' } }, 401)
    }
    const session = createSession(accountsDb, user.id)
    const secure = c.req.url.startsWith('https://')
    c.header('set-cookie', sessionCookie(session, secure))
    return c.json({ ok: true, data: { user: toPublicUser(user) } })
  })

  app.post('/api/auth/logout', (c) => {
    const session = c.get('sessionToken')
    if (session) deleteSession(accountsDb, session)
    const secure = c.req.url.startsWith('https://')
    c.header('set-cookie', `daily_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`)
    return c.json({ ok: true, data: { loggedOut: true } })
  })

  app.get('/api/auth/me', (c) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } }, 401)
    }
    return c.json({ ok: true, data: { user: toPublicUser(user) } })
  })

  app.post('/api/auth/password', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } }, 401)
    let body: unknown = {}
    try {
      body = await c.req.json()
    } catch {
      body = {}
    }
    const parsed = ChangePasswordInput.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? '输入不合法' } },
        422,
      )
    }
    try {
      changePassword(accountsDb, user.id, parsed.data.currentPassword, parsed.data.newPassword)
      deleteOtherSessions(accountsDb, user.id, c.get('sessionToken') ?? undefined)
      return c.json({ ok: true, data: { changed: true } })
    } catch (error) {
      if (error instanceof OpError) {
        return c.json({ ok: false, error: { code: error.code, message: error.message } }, error.code === 'UNAUTHORIZED' ? 401 : 400)
      }
      return c.json({ ok: false, error: { code: 'INTERNAL', message: '修改密码失败' } }, 500)
    }
  })

  app.post('/api/auth/avatar', async (c) => {
    const user = c.get('user')
    if (!user) return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } }, 401)
    let body: Record<string, unknown>
    try {
      body = (await c.req.parseBody()) as Record<string, unknown>
    } catch {
      return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: '无法解析上传内容' } }, 400)
    }
    const file = body.file
    if (!file || typeof file === 'string') {
      return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: '缺少头像文件' } }, 400)
    }
    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
    const upload = file as File
    if (!allowed.has(upload.type)) {
      return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: '头像仅支持 PNG / JPEG / WebP / GIF' } }, 400)
    }
    const data = new Uint8Array(await upload.arrayBuffer())
    if (data.byteLength > 5 * 1024 * 1024) {
      return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: '头像不能超过 5MB' } }, 400)
    }
    const updated = setAvatar(accountsDb, user.id, data, upload.type)
    return c.json({ ok: true, data: { user: toPublicUser(updated) } })
  })

  app.delete('/api/auth/avatar', (c) => {
    const user = c.get('user')
    if (!user) return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } }, 401)
    return c.json({ ok: true, data: { user: toPublicUser(clearAvatar(accountsDb, user.id)) } })
  })

  app.get('/api/auth/avatar/:id', (c) => {
    const user = c.get('user')
    if (!user) return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } }, 401)
    const avatar = getAvatar(accountsDb, c.req.param('id'))
    if (!avatar) return c.text('Not Found', 404)
    return new Response(avatar.data as unknown as BodyInit, {
      headers: {
        'content-type': avatar.mime,
        'cache-control': 'private, max-age=60',
      },
    })
  })

  app.get('/api/health', (c) => {
    const count = rootDb.prepare('SELECT COUNT(*) AS c FROM tasks').get() as { c: number }
    return c.json({
      ok: true,
      version,
      dataDir: paths.dataDir,
      database: paths.dbFile,
      uptimeSeconds: Math.round(process.uptime()),
      taskCount: count.c,
    })
  })

  app.get('/api/meta', (c) =>
    c.json({
      version,
      schemaVersion: 5,
      dataDir: paths.dataDir,
      platform: process.platform,
      builtAt: process.env.DAILYWORK_BUILT_AT ?? null,
    }),
  )

  app.get('/api/ops', (c) => c.json({ ok: true, data: listOpsMeta() }))

  app.get('/api/ops/:name', (c) => {
    const name = c.req.param('name')
    try {
      const op = getOp(name)
      const meta: OpDescriptorMeta = opMeta(op)
      return c.json({ ok: true, data: meta })
    } catch {
      return c.json(
        { ok: false, error: { code: 'NOT_FOUND', message: '未知操作' }, meta: { opId: '', version: 1 } },
        404,
      )
    }
  })

  app.post('/api/ops/:name', async (c) => {
    const name = c.req.param('name')
    let body: Record<string, unknown> = {}
    try {
      body = (await c.req.json()) as Record<string, unknown>
    } catch {
      body = {}
    }
    let op
    try {
      op = getOp(name)
    } catch {
      return c.json(
        {
          ok: false,
          error: { code: 'NOT_FOUND', message: `未知操作：${name}` },
          meta: { opId: '', version: 1 },
        },
        404,
      )
    }
    const meta = opMeta(op)
    if (op.kind === 'command') {
      if (meta.annotations.confirm && body.confirm !== true && c.req.header('x-daily-confirm') !== 'true') {
        return c.json(
          {
            ok: false,
            error: {
              code: 'CONFIRM_REQUIRED',
              message: `操作 ${name} 需要确认（在请求体传入 confirm: true 或命令行加 --yes）`,
            },
            meta: { opId: String(body.opId ?? ''), version: op.version },
          },
          428,
        )
      }
    }
    const { actor, source } = actorFrom(c.req.raw.headers)
    const ctx: OpContext = {
      db: c.get('db'),
      dataDir: paths.dataDir,
      actor,
      source,
      version,
      port: actualPort,
      httpsPort: actualHttpsPort,
      pairingCode: options.pairingCode,
      userId: c.get('user')?.id,
    }
    const result = await runOp(op, ctx, body)
    if (result.envelope.ok && op.kind === 'command') {
      broadcast({
        type: 'op',
        command: name,
        opId: result.envelope.meta.opId,
        at: new Date().toISOString(),
      })
    }
    return c.json(result.envelope, result.status as 200)
  })

  app.post('/api/attachments', async (c) => {
    let body: Record<string, unknown>
    try {
      body = (await c.req.parseBody()) as Record<string, unknown>
    } catch {
      return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: '无法解析上传内容' } }, 400)
    }
    const file = body.file
    if (!file || typeof file === 'string') {
      return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: '缺少文件' } }, 400)
    }
    const ownerTypeRaw = typeof body.ownerType === 'string' ? body.ownerType : ''
    const ownerId = typeof body.ownerId === 'string' ? body.ownerId : ''
    const parsedType = OwnerType.safeParse(ownerTypeRaw)
    if (!parsedType.success || !ownerId) {
      return c.json({ ok: false, error: { code: 'BAD_REQUEST', message: '缺少附件归属' } }, 400)
    }
    const upload = file as File
    const buffer = new Uint8Array(await upload.arrayBuffer())
    let thumb: Uint8Array | null = null
    const thumbFile = body.thumb
    if (thumbFile && typeof thumbFile !== 'string') {
      thumb = new Uint8Array(await (thumbFile as File).arrayBuffer())
    }
    try {
      const attachment = saveAttachment(c.get('db'), {
        ownerType: parsedType.data,
        ownerId,
        filename: upload.name || 'attachment',
        mime: upload.type,
        data: buffer,
        thumbData: thumb,
      })
      return c.json({ ok: true, data: attachment })
    } catch (error) {
      const message = error instanceof Error ? error.message : '上传失败'
      return c.json({ ok: false, error: { code: 'BAD_REQUEST', message } }, 400)
    }
  })

  app.get('/api/attachments/:id/content', (c) => {
    try {
      const file = getAttachmentContent(c.get('db'), c.req.param('id'), false)
      return new Response(file.data as unknown as BodyInit, {
        headers: {
          'content-type': file.mime,
          'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
          'cache-control': 'public, max-age=31536000, immutable',
        },
      })
    } catch {
      return c.text('Not Found', 404)
    }
  })

  app.get('/api/attachments/:id/thumb', (c) => {
    try {
      const file = getAttachmentContent(c.get('db'), c.req.param('id'), true)
      return new Response(file.data as unknown as BodyInit, {
        headers: {
          'content-type': file.mime,
          'cache-control': 'public, max-age=31536000, immutable',
        },
      })
    } catch {
      return c.text('Not Found', 404)
    }
  })

  app.post('/api/ai/chat/stream', async (c) => {
    let body: unknown = {}
    try {
      body = await c.req.json()
    } catch {
      body = {}
    }
    const parsed = ChatInput.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '输入参数校验失败',
            details: parsed.error.issues,
          },
          meta: { opId: '', version: 1 },
        },
        422,
      )
    }
    const { actor, source } = actorFrom(c.req.raw.headers)
    const ctx: OpContext = {
      db: c.get('db'),
      dataDir: paths.dataDir,
      actor,
      source,
      version,
      port: actualPort,
      httpsPort: actualHttpsPort,
      pairingCode: options.pairingCode,
      userId: c.get('user')?.id,
    }
    return streamSSE(c, async (stream) => {
      try {
        const result = await runAssistantChat(ctx, parsed.data, allOps, {
          stream: true,
          onEvent: async (event) => {
            await stream.writeSSE({ event: event.type, data: JSON.stringify(event) })
          },
        })
        await stream.writeSSE({
          event: 'done',
          data: JSON.stringify({ type: 'done', result }),
        })
      } catch (error) {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : String(error),
          }),
        })
      }
    })
  })

  app.get('/api/events', (c) => {
    return streamSSE(c, async (stream) => {
      let closed = false
      stream.onAbort(() => {
        closed = true
      })
      const controller = {
        enqueue(chunk: Uint8Array) {
          void stream.writeSSE({ data: new TextDecoder().decode(chunk).replace(/^data: /, '').trim() })
        },
      } as unknown as ReadableStreamDefaultController<Uint8Array>
      sseClients.add(controller)
      await stream.writeSSE({ data: JSON.stringify({ type: 'hello', at: new Date().toISOString() }) })
      while (!closed) {
        await stream.sleep(25_000)
        if (closed) break
        await stream.writeSSE({ data: JSON.stringify({ type: 'ping', at: new Date().toISOString() }) })
      }
      sseClients.delete(controller)
    })
  })

  const webDist = options.webDist
  if (webDist && existsSync(webDist)) {
    app.get('*', async (c) => {
      const url = new URL(c.req.url)
      let pathname = decodeURIComponent(url.pathname)
      if (pathname === '/') pathname = '/index.html'
      const filePath = normalize(join(resolve(webDist), pathname))
      if (!filePath.startsWith(resolve(webDist))) {
        return c.text('Forbidden', 403)
      }
      if (pathname !== '/index.html' && existsSync(filePath) && !pathname.startsWith('/api/')) {
        const data = await readFile(filePath)
        return new Response(data, {
          headers: {
            'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
            'cache-control': pathname.startsWith('/assets/')
              ? 'public, max-age=31536000, immutable'
              : 'no-cache',
          },
        })
      }
      if (pathname.startsWith('/api/')) return c.text('Not Found', 404)
      const remote = remoteAddress(c)
      if (!isLoopback(remote)) {
        const sessionToken = cookieValue(c.req.header('cookie'), 'daily_session')
        const sessionUser = sessionToken ? getSessionUser(accountsDb, sessionToken) : null
        if (!sessionUser) return c.html(pairPage())
      }
      const index = await readFile(join(resolve(webDist), 'index.html'))
      return new Response(index, {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-cache',
          'content-security-policy':
            "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'no-referrer',
        },
      })
    })
  }

  return {
    app,
    db: rootDb,
    token,
    sseClients,
    setPort: (port: number) => {
      actualPort = port
    },
    setHttpsPort: (port: number) => {
      actualHttpsPort = port
    },
    closeDb: () => {
      for (const db of userDbs.values()) {
        try {
          db.close()
        } catch {
          // ignore
        }
      }
      try {
        accountsDb.close()
      } catch {
        // ignore
      }
      try {
        rootDb.close()
      } catch {
        // ignore
      }
    },
  }
}

export function launchHttps(
  app: Hono<any>,
  port: number,
  host: string,
  cert: Buffer | string,
  key: Buffer | string,
): Promise<Server> {
  return new Promise((resolvePromise, reject) => {
    const listener = getRequestListener(app.fetch)
    const server = createHttpsServer({ cert, key }, listener)
    server.on('error', reject)
    server.listen(port, host, () => resolvePromise(server))
  })
}

export function launchHttp(app: Hono<any>, port = 0, host = '127.0.0.1'): Promise<Server> {
  return new Promise((resolvePromise, reject) => {
    const server = serve({ fetch: app.fetch, port, hostname: host }, () => {
      resolvePromise(server as unknown as Server)
    }) as unknown as Server
    server.on('error', reject)
  })
}

export { allOps }


function pairPage(): string {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>配对时序 · Dailywork</title>
<style>
:root{--bg:#FAF9F5;--card:#fff;--line:#E8E6DC;--ink:#141413;--ink2:#5B5750;--ink3:#8A857D;--accent:#D97757}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;padding:24px}
.card{width:min(400px,100%);background:var(--card);border:1px solid var(--line);border-radius:16px;padding:30px 28px;box-shadow:0 10px 40px rgba(20,20,19,.06)}
.brand{display:flex;align-items:center;gap:10px;margin-bottom:22px}
.brand img{width:38px;height:38px;object-fit:contain}
.brand b{font-size:16px;letter-spacing:.3px}
h1{font-size:22px;letter-spacing:-.4px;margin:0 0 8px}
p{font-size:12px;line-height:1.65;color:var(--ink3);margin:0 0 20px}
label{display:block;font-size:11px;color:var(--ink3);margin-bottom:6px}
input{width:100%;height:46px;border:1px solid var(--line);border-radius:9px;background:var(--bg);font-size:22px;letter-spacing:8px;text-align:center;font-variant-numeric:tabular-nums;color:var(--ink);outline:none}
input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(217,119,87,.12)}
button{width:100%;height:42px;margin-top:14px;border:none;border-radius:9px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer}
button:disabled{opacity:.5}
.msg{font-size:11px;color:#B5473C;margin-top:10px;min-height:16px;text-align:center}
.note{font-size:10px;color:var(--ink3);margin-top:18px;line-height:1.6;text-align:center}
</style></head>
<body><div class="card">
<div class="brand"><img src="/logo.png" alt="" /><b>时序 · Dailywork</b></div>
<h1>配对这台设备</h1>
<p>在 Mac 的「设置 → 通用 → 局域网访问」中查看 6 位配对码。配对后，这台设备可以安全地访问同一 Wi-Fi 下的时序数据。</p>
<label for="code">配对码</label>
<input id="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" />
<button id="go">配对并进入</button>
<div class="msg" id="msg"></div>
<div class="note">数据只保存在你的 Mac 上，不会上传到任何服务器。</div>
</div>
<script>
const input = document.getElementById('code');
const button = document.getElementById('go');
const msg = document.getElementById('msg');
async function submit() {
  const code = input.value.replace(/\\D/g, '');
  if (code.length !== 6) { msg.textContent = '请输入 6 位配对码'; return; }
  button.disabled = true;
  try {
    const res = await fetch('/api/pair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
    const data = await res.json();
    if (data.ok) { location.href = '/today'; return; }
    msg.textContent = data.error?.message || '配对失败';
  } catch { msg.textContent = '无法连接，请确认在同一 Wi-Fi 下'; }
  button.disabled = false;
}
button.addEventListener('click', submit);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
</script></body></html>`
}
