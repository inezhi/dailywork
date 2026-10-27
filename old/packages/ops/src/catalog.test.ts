import { describe, expect, it } from 'vitest'
import { allOps, cliOps, listOpsMeta } from './catalog'

describe('ops catalog', () => {
  const metas = listOpsMeta()

  it('has unique names', () => {
    const names = allOps.map((op) => op.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('exposes valid HTTP descriptors', () => {
    for (const op of allOps) {
      expect(op.version).toBeGreaterThan(0)
      expect(['command', 'query']).toContain(op.kind)
      expect(typeof op.handler).toBe('function')
      if (op.exposure.http) expect(op.summary.length).toBeGreaterThan(0)
    }
  })

  it('marks destructive operations for confirmation', () => {
    const byName = new Map(metas.map((meta) => [meta.name, meta]))
    for (const name of ['task.delete', 'memo.delete', 'project.delete', 'document.delete', 'backup.import']) {
      const meta = byName.get(name)
      expect(meta, name).toBeDefined()
      expect(meta!.annotations.destructive, name).toBe(true)
      expect(meta!.annotations.confirm, name).toBe(true)
    }
  })

  it('exposes task creation and reading to AI tools', () => {
    const ai = metas.filter((meta) => meta.exposure.ai).map((meta) => meta.name)
    expect(ai).toContain('task.create')
    expect(ai).toContain('task.list')
    expect(ai).toContain('today.get')
    expect(ai).not.toContain('backup.import')
    expect(ai).not.toContain('ai.chat')
  })

  it('keeps CLI paths unique and gives task.create its primary argument', () => {
    const paths = cliOps().map((op) => (op.exposure.cli as string[]).join(' '))
    expect(new Set(paths).size).toBe(paths.length)
    const create = metas.find((meta) => meta.name === 'task.create')!
    const schema = create.inputSchema as { properties?: Record<string, unknown>; required?: string[] }
    expect(schema.properties?.title).toBeDefined()
    expect(schema.required).toContain('title')
  })
})
