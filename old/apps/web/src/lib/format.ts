const pad = (n: number) => String(n).padStart(2, '0')

export function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayIso(): string {
  return toDateOnly(new Date())
}

export function parseDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date)
  d.setDate(d.getDate() + days)
  return toDateOnly(d)
}

export function startOfWeek(date: string, weekStartsOn = 1): string {
  const d = parseDate(date)
  const diff = (d.getDay() - weekStartsOn + 7) % 7
  d.setDate(d.getDate() - diff)
  return toDateOnly(d)
}

export function endOfWeek(date: string, weekStartsOn = 1): string {
  return addDays(startOfWeek(date, weekStartsOn), 6)
}

export function endOfMonth(date: string): string {
  const d = parseDate(date)
  d.setMonth(d.getMonth() + 1, 0)
  return toDateOnly(d)
}

export function startOfMonth(date: string): string {
  const d = parseDate(date)
  d.setDate(1)
  return toDateOnly(d)
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = []
  let cur = from
  let guard = 0
  while (cur <= to && guard < 400) {
    out.push(cur)
    cur = addDays(cur, 1)
    guard++
  }
  return out
}

export function monthGrid(anchor: string, weekStartsOn = 1): string[] {
  const first = startOfMonth(anchor)
  const start = startOfWeek(first, weekStartsOn)
  return dateRange(start, addDays(start, 41))
}

export function weekdayLabel(date: string): string {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][parseDate(date).getDay()]!
}

export function monthLabel(date: string): string {
  const d = parseDate(date)
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`
}

export function shortDate(date: string | null | undefined): string {
  if (!date) return ''
  const d = parseDate(date)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

export function dateBadge(date: string | null | undefined): { text: string; tone: 'normal' | 'warn' | 'danger' } {
  if (!date) return { text: '', tone: 'normal' }
  const today = todayIso()
  const diff = Math.round((parseDate(date).getTime() - parseDate(today).getTime()) / 86400000)
  if (diff === 0) return { text: '今天', tone: 'warn' }
  if (diff === 1) return { text: '明天', tone: 'normal' }
  if (diff === -1) return { text: '昨天', tone: 'danger' }
  if (diff < -1) return { text: `${shortDate(date)} · 逾期 ${-diff} 天`, tone: 'danger' }
  if (diff <= 7) return { text: weekdayLabel(date), tone: 'normal' }
  return { text: shortDate(date), tone: 'normal' }
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso)
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} 天前`
  return shortDate(toDateOnly(new Date(iso)))
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return ''
  if (minutes < 60) return `${minutes} 分钟`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} 小时` : `${h} 小时 ${m} 分`
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${pad(m)}:${pad(sec)}`
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

export function fullDateLabel(date: string): string {
  const d = parseDate(date)
  const today = todayIso()
  const prefix =
    date === today ? '今天' : date === addDays(today, 1) ? '明天' : date === addDays(today, -1) ? '昨天' : ''
  return `${prefix ? prefix + ' · ' : ''}${d.getMonth() + 1} 月 ${d.getDate()} 日 ${weekdayLabel(date)}`
}

export const STATUS_LABEL: Record<string, string> = {
  inbox: '收件箱',
  next: '下一步',
  doing: '进行中',
  waiting: '等待中',
  blocked: '受阻',
  done: '已完成',
}

export const PRIORITY_LABEL: Record<string, string> = {
  none: '无优先级',
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
}

export const STATUS_ORDER = ['doing', 'next', 'waiting', 'blocked', 'inbox', 'done'] as const

export function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '我'
}
