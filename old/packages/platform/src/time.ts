/** All calendar dates are local-time `YYYY-MM-DD` strings; timestamps are ISO-8601 UTC. */

const pad = (n: number) => String(n).padStart(2, '0')

export function nowIso(): string {
  return new Date().toISOString()
}

export function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayLocal(now = new Date()): string {
  return toDateOnly(now)
}

export function parseDateOnly(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

export function addDays(date: string, days: number): string {
  const d = parseDateOnly(date)
  d.setDate(d.getDate() + days)
  return toDateOnly(d)
}

export function startOfWeek(date: string, weekStartsOn = 1): string {
  const d = parseDateOnly(date)
  const diff = (d.getDay() - weekStartsOn + 7) % 7
  d.setDate(d.getDate() - diff)
  return toDateOnly(d)
}

export function endOfWeek(date: string, weekStartsOn = 1): string {
  return addDays(startOfWeek(date, weekStartsOn), 6)
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = []
  let cur = from
  let guard = 0
  while (cur <= to && guard < 1000) {
    out.push(cur)
    cur = addDays(cur, 1)
    guard++
  }
  return out
}

export function weekday(date: string): number {
  return parseDateOnly(date).getDay()
}

export function diffDays(a: string, b: string): number {
  const ms = parseDateOnly(a).getTime() - parseDateOnly(b).getTime()
  return Math.round(ms / 86_400_000)
}

export function isValidDateOnly(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = parseDateOnly(v)
  return toDateOnly(d) === v
}

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60_000))
}

export function localDayBoundsUtc(date: string): { start: string; end: string } {
  const start = parseDateOnly(date)
  const end = parseDateOnly(addDays(date, 1))
  return { start: start.toISOString(), end: end.toISOString() }
}
