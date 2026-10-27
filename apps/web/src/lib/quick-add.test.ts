import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseQuickAdd } from './quick-add'

describe('quick add grammar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 27, 10, 0, 0))
  })
  afterEach(() => vi.useRealTimers())

  it('extracts tags, priority and relative dates', () => {
    expect(parseQuickAdd('写周报 #工作 #深度工作 !2 @tomorrow')).toEqual({
      title: '写周报',
      tags: ['工作', '深度工作'],
      priority: 'high',
      scheduledDate: '2026-10-28',
    })
  })

  it('supports Chinese date words and explicit dates', () => {
    expect(parseQuickAdd('整理桌面 @今天').scheduledDate).toBe('2026-10-27')
    expect(parseQuickAdd('回顾 @明天').scheduledDate).toBe('2026-10-28')
    expect(parseQuickAdd('准备 @2026-11-01').scheduledDate).toBe('2026-11-01')
  })

  it('maps priority tokens and deduplicates tags', () => {
    const parsed = parseQuickAdd('一个任务 #重复 #重复 !1')
    expect(parsed.tags).toEqual(['重复'])
    expect(parsed.priority).toBe('urgent')
    expect(parsed.title).toBe('一个任务')
  })

  it('keeps unknown tokens in the title and tolerates empty input', () => {
    expect(parseQuickAdd('读 @书 #').title).toBe('读 @书 #')
    expect(parseQuickAdd('   ').title).toBe('')
  })
})
