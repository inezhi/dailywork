import { describe, expect, it } from 'vitest'
import {
  addDays,
  dateRange,
  diffDays,
  endOfWeek,
  isValidDateOnly,
  localDayBoundsUtc,
  parseDateOnly,
  startOfWeek,
  toDateOnly,
  todayLocal,
  weekday,
} from './time'

describe('time', () => {
  it('formats local dates with zero padding', () => {
    expect(toDateOnly(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(todayLocal(new Date(2026, 9, 27, 23, 59))).toBe('2026-10-27')
  })

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-27', 5)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('computes week boundaries honoring the start day', () => {
    expect(startOfWeek('2026-10-27', 1)).toBe('2026-10-26')
    expect(endOfWeek('2026-10-27', 1)).toBe('2026-11-01')
    expect(startOfWeek('2026-10-27', 0)).toBe('2026-10-25')
    expect(weekday('2026-10-27')).toBe(2)
  })

  it('builds inclusive ranges and day differences', () => {
    const days = dateRange('2026-10-25', '2026-11-01')
    expect(days).toHaveLength(8)
    expect(days[0]).toBe('2026-10-25')
    expect(days.at(-1)).toBe('2026-11-01')
    expect(diffDays('2026-11-01', '2026-10-27')).toBe(5)
    expect(dateRange('2026-10-27', '2026-10-25')).toEqual([])
  })

  it('validates real calendar dates', () => {
    expect(isValidDateOnly('2026-10-27')).toBe(true)
    expect(isValidDateOnly('2026-02-29')).toBe(false)
    expect(isValidDateOnly('2028-02-29')).toBe(true)
    expect(isValidDateOnly('2026-13-01')).toBe(false)
    expect(isValidDateOnly('27/10/2026')).toBe(false)
  })

  it('anchors local day bounds to local midnight', () => {
    const bounds = localDayBoundsUtc('2026-06-15')
    expect(new Date(bounds.start).getHours()).toBe(0)
    expect(parseDateOnly('2026-06-15').getTime()).toBe(new Date(bounds.start).setHours(0, 0, 0, 0))
    expect(Date.parse(bounds.end) - Date.parse(bounds.start)).toBe(86_400_000)
  })
})
