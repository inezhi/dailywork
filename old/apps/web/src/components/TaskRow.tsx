import type { ReactNode } from 'react'
import type { Task } from '@daily/contracts'
import { CalendarClock, ChevronRight, Flag, ListChecks } from 'lucide-react'
import { useOpMutation } from '@/lib/query'
import { useUi } from '@/stores/ui'
import { toast } from '@/stores/toast'
import { dateBadge, formatDuration, relativeTime, STATUS_LABEL } from '@/lib/format'
import { StatusButton } from './StatusButton'
import { PriorityFlag, ProjectChip, TagChip } from './Chips'

export function TaskRow({
  task,
  showProject = true,
  showDate = true,
  compact = false,
}: {
  task: Task
  showProject?: boolean
  showDate?: boolean
  compact?: boolean
}) {
  const openTask = useUi((s) => s.openTask)
  const selected = useUi((s) => s.drawerTaskId === task.id)
  const complete = useOpMutation<{ id: string }, Task>('task.complete', {
    silent: true,
    onSuccess: () => toast.success('已完成'),
  })
  const reopen = useOpMutation<{ id: string }, Task>('task.reopen', { silent: true })

  const toggle = () => {
    if (task.status === 'done') reopen.mutate({ id: task.id })
    else complete.mutate({ id: task.id })
  }

  const due = task.dueDate ? dateBadge(task.dueDate) : null
  const scheduled = task.scheduledDate ? dateBadge(task.scheduledDate) : null
  const subline: ReactNode[] = []
  if (showProject && task.projectName) {
    subline.push(<ProjectChip key="project" name={task.projectName} color={task.projectColor} />)
  }
  if (showDate && task.scheduledDate) {
    subline.push(
      <span key="sched" className="icon-pill">
        <CalendarClock size={11} /> {scheduled?.text}
      </span>,
    )
  }
  if (showDate && task.dueDate) {
    subline.push(
      <span key="due" className={`icon-pill ${due?.tone === 'danger' ? 'overdue-text' : ''}`}>
        <Flag size={10} /> {due?.text}
      </span>,
    )
  }
  for (const tag of task.tags.slice(0, 2)) {
    subline.push(<TagChip key={tag.id} name={tag.name} color={tag.color} />)
  }
  if (task.subtaskTotal) {
    subline.push(
      <span key="sub" className="icon-pill">
        <ListChecks size={11} /> {task.subtaskDone}/{task.subtaskTotal}
      </span>,
    )
  }
  if (compact && task.status !== 'done') {
    subline.push(<span key="status" className="icon-pill">{STATUS_LABEL[task.status]}</span>)
  }

  return (
    <div
      className={`task-row ${task.status === 'done' ? 'is-done' : ''} ${selected ? 'is-selected' : ''}`}
      onClick={() => openTask(task.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openTask(task.id)
        }
      }}
    >
      <StatusButton status={task.status} onClick={toggle} />
      <div className="task-main">
        <div className="task-title">{task.title}</div>
        {subline.length > 0 && <div className="task-sub">{subline}</div>}
        {!compact && task.status === 'done' && task.completedAt && (
          <div className="task-sub">完成于 {relativeTime(task.completedAt)}</div>
        )}
      </div>
      <div className="task-meta">
        <PriorityFlag priority={task.priority} />
      </div>
      <div className="task-est">{formatDuration(task.estimateMinutes)}</div>
      <span className="task-arrow">
        <ChevronRight size={14} />
      </span>
    </div>
  )
}
