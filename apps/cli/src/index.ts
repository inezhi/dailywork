#!/usr/bin/env node
import { listOpsMeta } from '@daily/ops'
import type { OpDescriptorMeta } from '@daily/contracts'
import { parseArgv, type ParsedArgs } from './args.js'
import { callOp, ensureServer, resolveCliDataDir } from './client.js'
import { serveMcp } from './mcp.js'

const VERSION = '0.1.0'
const EXIT_BY_CODE: Record<string, number> = {
  VALIDATION_ERROR: 2,
  BAD_REQUEST: 2,
  UNAUTHORIZED: 2,
  NOT_FOUND: 3,
  VERSION_CONFLICT: 4,
  CONFLICT: 4,
  CONFIRM_REQUIRED: 5,
  INTERNAL: 1,
}

const PRIMARY_FIELD: Record<string, string> = {
  'task.create': 'title',
  'task.update': 'id',
  'task.move': 'id',
  'task.complete': 'id',
  'task.reopen': 'id',
  'task.delete': 'id',
  'task.get': 'id',
  'task.activity': 'id',
  'tag.update': 'id',
  'tag.delete': 'id',
  'memo.create': 'content',
  'memo.get': 'id',
  'memo.update': 'id',
  'memo.delete': 'id',
  'memo.toTask': 'id',
  'project.create': 'name',
  'project.get': 'id',
  'project.update': 'id',
  'project.archive': 'id',
  'project.delete': 'id',
  'space.create': 'name',
  'space.update': 'id',
  'document.create': 'title',
  'document.get': 'id',
  'document.update': 'id',
  'document.saveBody': 'id',
  'document.delete': 'id',
  'document.archive': 'id',
  'document.getMeta': 'id',
  'deliverable.create': 'title',
  'deliverable.update': 'id',
  'deliverable.delete': 'id',
  'deliverable.list': 'projectId',
  'template.create': 'name',
  'template.delete': 'id',
  'template.apply': 'id',
  'search.all': 'query',
  'inbox.capture': 'content',
  'focus.finish': 'id',
  'focus.cancel': 'id',
  'routine.create': 'name',
  'routine.toggle': 'id',
  'routine.delete': 'id',
  'backup.export': 'targetPath',
  'backup.import': 'sourcePath',
  'ai.chat': 'message',
  'attachment.delete': 'id',
}

const FLAG_ALIASES: Record<string, string> = {
  due: 'dueDate',
  date: 'scheduledDate',
  project: 'projectId',
  space: 'spaceId',
  estimate: 'estimateMinutes',
  capacity: 'capacityMinutes',
  owner: 'ownerId',
  tag: 'tagId',
  parent: 'parentId',
}

interface SchemaProperty {
  type?: string
  anyOf?: Array<{ type?: string }>
  oneOf?: Array<{ type?: string }>
}

function propertyType(prop: SchemaProperty | undefined): string | null {
  if (!prop) return null
  if (prop.type) return prop.type
  const variants = prop.anyOf ?? prop.oneOf ?? []
  for (const variant of variants) {
    if (variant.type && variant.type !== 'null') return variant.type
  }
  return null
}

function buildInput(
  op: OpDescriptorMeta,
  args: ParsedArgs,
): { input: Record<string, unknown>; error?: string } {
  const schema = op.inputSchema as {
    properties?: Record<string, SchemaProperty>
    required?: string[]
  }
  const props = schema.properties ?? {}
  const input: Record<string, unknown> = {}
  const positionals = [...args.positionals]
  const primary = PRIMARY_FIELD[op.name]
  if (primary && positionals.length > 0) {
    input[primary] = positionals.shift()
  }
  if (positionals.length > 0) {
    return { input, error: `多余的位置参数：${positionals.join(' ')}` }
  }
  const skip = new Set(['json', 'yes', 'help', 'url', 'dataDir'])
  for (const [rawKey, rawValue] of Object.entries(args.flags)) {
    if (skip.has(rawKey)) continue
    const alias = FLAG_ALIASES[rawKey]
    const key = alias && props[alias] ? alias : rawKey
    const prop = props[key]
    if (!prop) {
      return { input, error: `未知参数：--${rawKey}` }
    }
    const type = propertyType(prop)
    if (type === 'boolean') {
      input[key] = rawValue === true || rawValue === 'true' || rawValue === '1'
    } else if (type === 'number' || type === 'integer') {
      const n = Number(rawValue)
      if (!Number.isFinite(n)) return { input, error: `参数 --${rawKey} 需要数字` }
      input[key] = n
    } else if (type === 'array') {
      const value = String(rawValue)
      input[key] = value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
    } else {
      if (rawValue === true) return { input, error: `参数 --${rawKey} 需要值` }
      input[key] = rawValue
    }
  }
  return { input }
}

function findOp(positionals: string[]): { op: OpDescriptorMeta; rest: string[] } | null {
  const metas = listOpsMeta().filter((op) => Array.isArray(op.exposure.cli))
  const sorted = metas.sort(
    (a, b) => (b.exposure.cli as string[]).length - (a.exposure.cli as string[]).length,
  )
  for (const op of sorted) {
    const path = op.exposure.cli as string[]
    if (path.every((part, i) => positionals[i] === part)) {
      return { op, rest: positionals.slice(path.length) }
    }
  }
  return null
}

function printGlobalHelp(): void {
  console.log(`daily ${VERSION} — 时序命令行

用法：
  daily <组> <动作> [参数...] [--json] [--yes]

常用：
  daily today --json
  daily task create "写周报" --due 2026-10-30 --estimate 45 --json
  daily task list --status doing --json
  daily task complete <id> --json
  daily memo create "一个想法 #灵感"
  daily project list --json
  daily search "深度工作" --json
  daily mcp serve

全局参数：
  --json        输出完整 JSON 信封（供 AI / 脚本使用）
  --yes         确认破坏性操作
  --data-dir    指定数据目录
  --url         指定本地服务地址

运行 daily ops 查看全部操作。`)
}

function printOps(filter?: string): void {
  const metas = listOpsMeta()
    .filter((op) => op.exposure.cli)
    .filter((op) => !filter || (op.exposure.cli as string[])[0] === filter)
  for (const op of metas) {
    console.log(`${(op.exposure.cli as string[]).join(' ').padEnd(32)} ${op.summary}`)
  }
}

function printOpHelp(op: OpDescriptorMeta): void {
  const path = (op.exposure.cli as string[]).join(' ')
  const schema = op.inputSchema as {
    properties?: Record<string, SchemaProperty>
    required?: string[]
  }
  console.log(`${path} — ${op.summary}\n`)
  if (op.description) console.log(`${op.description}\n`)
  const primary = PRIMARY_FIELD[op.name]
  if (primary) console.log(`位置参数：<${primary}>`)
  const props = schema.properties ?? {}
  const keys = Object.keys(props).filter((k) => k !== primary && k !== 'opId')
  if (keys.length) {
    console.log('参数：')
    for (const key of keys) {
      const type = propertyType(props[key])
      const required = schema.required?.includes(key) ? '（必填）' : ''
      console.log(`  --${camelToKebab(key)} <${type ?? 'value'}>${required}`)
    }
  }
  if (op.annotations.confirm) console.log('\n破坏性操作：需要 --yes 确认。')
}

function camelToKebab(key: string): string {
  return key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
}

function printHuman(data: unknown): void {
  if (data == null) {
    console.log('（空）')
    return
  }
  if (Array.isArray(data)) {
    if (data.length === 0) {
      console.log('（空）')
      return
    }
    for (const item of data as Array<Record<string, unknown>>) {
      if (item && typeof item === 'object' && 'title' in item) {
        console.log(`• ${item.title}${item.status ? ` · ${item.status}` : ''}`)
      } else if (item && typeof item === 'object' && 'name' in item) {
        console.log(`• ${item.name}`)
      } else {
        console.log(JSON.stringify(item, null, 2))
      }
    }
    return
  }
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.items)) {
      printHuman(obj.items)
      return
    }
    if (typeof obj.date === 'string' && Array.isArray(obj.scheduled)) {
      console.log(obj.date)
      console.log(`  已安排 ${obj.scheduled.length} 项 · 逾期 ${Array.isArray(obj.overdue) ? obj.overdue.length : 0} 项 · 今日完成 ${Array.isArray(obj.completed) ? obj.completed.length : 0} 项 · 专注 ${obj.focusMinutes ?? 0} 分钟`)
      for (const task of obj.scheduled as Array<Record<string, unknown>>) {
        console.log(`  [${task.status === 'done' ? 'x' : ' '}] ${task.title}${task.estimateMinutes ? ` · ${task.estimateMinutes} 分钟` : ''}`)
      }
      return
    }
    if (typeof obj.message === 'object' && obj.message && typeof (obj.message as Record<string, unknown>).content === 'string') {
      console.log((obj.message as Record<string, unknown>).content)
      return
    }
    if (typeof obj.title === 'string') {
      console.log(`${obj.title}${obj.status ? ` · ${obj.status}` : ''}`)
      return
    }
    if (typeof obj.path === 'string' && typeof obj.bytes === 'number') {
      console.log(`已导出 ${obj.path}（${(obj.bytes / 1024 / 1024).toFixed(1)} MB）`)
      return
    }
  }
  console.log(JSON.stringify(data, null, 2))
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const args = parseArgv(argv)
  const first = args.positionals[0]
  if (!first || first === 'help' || (args.help && !findOp(args.positionals))) {
    printGlobalHelp()
    return 0
  }
  if (first === 'version' || first === '--version') {
    console.log(VERSION)
    return 0
  }
  if (first === 'ops') {
    const filter = args.positionals[1]
    if (args.json) {
      console.log(
        JSON.stringify(
          listOpsMeta()
            .filter((op) => op.exposure.cli)
            .map((op) => ({ cmd: op.exposure.cli, name: op.name, summary: op.summary })),
          null,
          2,
        ),
      )
    } else {
      printOps(filter)
    }
    return 0
  }
  if (first === 'mcp') {
    if (args.positionals[1] !== 'serve') {
      console.error('用法：daily mcp serve')
      return 2
    }
    const urlFlag = typeof args.flags.url === 'string' ? args.flags.url : undefined
    if (urlFlag) process.env.DAILYWORK_URL = urlFlag
    await serveMcp(typeof args.flags.dataDir === 'string' ? args.flags.dataDir : undefined)
    return 0
  }

  const found = findOp(args.positionals)
  if (!found) {
    if (first && listOpsMeta().some((op) => (op.exposure.cli as string[])?.[0] === first)) {
      console.error(`未知动作。可用：`)
      printOps(first)
      return 2
    }
    console.error(`未知命令：${args.positionals.join(' ')}\n`)
    printGlobalHelp()
    return 2
  }
  const { op, rest } = found
  if (args.help) {
    printOpHelp(op)
    return 0
  }
  const built = buildInput(op, { ...args, positionals: rest })
  if (built.error) {
    console.error(built.error)
    console.error(`运行 daily ${(op.exposure.cli as string[]).join(' ')} --help 查看参数。`)
    return 2
  }
  if (op.annotations.confirm) {
    if (!args.yes) {
      console.error(`操作 ${op.name} 具有破坏性，请加 --yes 确认。`)
      console.error(`提示：${op.summary}`)
      return 5
    }
    built.input.confirm = true
  }
  const dataDir = resolveCliDataDir(
    typeof args.flags.dataDir === 'string' ? args.flags.dataDir : undefined,
  )
  if (typeof args.flags.url === 'string') process.env.DAILYWORK_URL = args.flags.url
  try {
    const runtime = await ensureServer(dataDir)
    const envelope = await callOp(runtime, op.name, built.input)
    if (args.json) {
      console.log(JSON.stringify(envelope, null, 2))
    } else if (!envelope.ok) {
      console.error(`错误 ${envelope.error?.code}: ${envelope.error?.message}`)
    } else {
      printHuman(envelope.data)
    }
    return envelope.ok ? 0 : (EXIT_BY_CODE[envelope.error?.code ?? 'INTERNAL'] ?? 1)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}

main().then((code) => {
  process.exitCode = code
})
