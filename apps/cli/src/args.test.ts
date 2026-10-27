import { describe, expect, it } from 'vitest'
import { normalizeKey, parseArgv } from './args'

describe('CLI argument parsing', () => {
  it('separates positionals, flags, json and yes', () => {
    const parsed = parseArgv([
      'task',
      'create',
      '写周报',
      '--due',
      '2026-10-30',
      '--estimate=25',
      '--json',
      '--yes',
    ])
    expect(parsed.positionals).toEqual(['task', 'create', '写周报'])
    expect(parsed.flags).toEqual({ due: '2026-10-30', estimate: '25' })
    expect(parsed.json).toBe(true)
    expect(parsed.yes).toBe(true)
    expect(parsed.help).toBe(false)
  })

  it('normalizes kebab-case keys and supports boolean flags', () => {
    const parsed = parseArgv(['task', 'list', '--due-date', '2026-10-30', '--include-archived'])
    expect(parsed.flags).toEqual({ dueDate: '2026-10-30', includeArchived: true })
    expect(normalizeKey('owner-type')).toBe('ownerType')
  })

  it('recognizes help and short confirm flags', () => {
    const parsed = parseArgv(['task', 'delete', 'tsk_1', '-y', '--help'])
    expect(parsed.help).toBe(true)
    expect(parsed.yes).toBe(true)
    expect(parsed.positionals).toEqual(['task', 'delete', 'tsk_1'])
  })
})
