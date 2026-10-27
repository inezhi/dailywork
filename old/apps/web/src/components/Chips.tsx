import { Flag } from 'lucide-react'
import type { Task } from '@daily/contracts'
import { dateBadge } from '@/lib/format'

export function PriorityFlag({
  priority,
  size = 12,
  showLabel = false,
}: {
  priority: Task['priority']
  size?: number
  showLabel?: boolean
}) {
  if (priority === 'none' && !showLabel) return null
  const label =
    priority === 'urgent'
      ? '紧急'
      : priority === 'high'
        ? '高'
        : priority === 'medium'
          ? '中'
          : priority === 'low'
            ? '低'
            : ''
  return (
    <span className={`prio ${priority}`} title={label ? `优先级：${label}` : '无优先级'}>
      <Flag
        size={size}
        strokeWidth={2.2}
        fill={priority === 'none' ? 'none' : 'currentColor'}
        opacity={priority === 'none' ? 0.45 : 1}
      />
      {showLabel && label && <span style={{ fontSize: 10, marginLeft: 4 }}>{label}</span>}
    </span>
  )
}

export function ProjectChip({
  name,
  color,
}: {
  name: string | null | undefined
  color?: string | null
}) {
  if (!name) return null
  return (
    <span
      className="chip project"
      style={{ ['--chip-color' as string]: color ?? 'var(--accent)' }}
      title={`项目：${name}`}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: 2,
          background: color ?? 'var(--accent)',
          display: 'inline-block',
        }}
      />
      {name}
    </span>
  )
}

export function TagChip({ name, color }: { name: string; color?: string }) {
  return (
    <span className="chip tag">
      <span style={{ color: color ?? 'var(--ink-3)' }}>#</span>
      {name}
    </span>
  )
}

export function DateChip({
  date,
  kind = 'due',
}: {
  date: string | null | undefined
  kind?: 'due' | 'scheduled'
}) {
  if (!date) return null
  const badge = dateBadge(date)
  return (
    <span
      className={`icon-pill ${badge.tone === 'danger' ? 'overdue-text' : ''}`}
      title={kind === 'due' ? `截止 ${date}` : `计划 ${date}`}
    >
      {kind === 'scheduled' ? '◷' : '⚑'} {badge.text}
    </span>
  )
}
