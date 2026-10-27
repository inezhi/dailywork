import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Projector } from 'lucide-react'
import type { ListResult, Project, Task, TaskStatus } from '@daily/contracts'
import { useOp, useOpMutation } from '@/lib/query'
import { useUi } from '@/stores/ui'
import { PriorityFlag, ProjectChip } from '@/components/Chips'
import { StatusButton } from '@/components/StatusButton'
import { EmptyState } from '@/components/EmptyState'
import { dateBadge, formatDuration, todayIso } from '@/lib/format'

const COLUMNS: Array<{ status: TaskStatus; label: string; tone: string }> = [
  { status: 'next', label: '下一步', tone: 'var(--ink-3)' },
  { status: 'doing', label: '进行中', tone: 'var(--accent)' },
  { status: 'waiting', label: '等待中', tone: 'var(--warning)' },
  { status: 'blocked', label: '受阻', tone: 'var(--danger)' },
]

export function BoardPage() {
  const openTask = useUi((s) => s.openTask)
  const { data: projects } = useOp<Project[]>('project.list', {})
  const [projectId, setProjectId] = useState('')
  const { data, isLoading } = useOp<ListResult<Task>>('task.list', {
    status: ['next', 'doing', 'waiting', 'blocked', 'done'],
    projectId: projectId || undefined,
    limit: 500,
    sort: 'manual',
  })
  const move = useOpMutation<{ id: string; status: TaskStatus; sortOrder: number }, Task>('task.move', {
    silent: true,
  })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [adding, setAdding] = useState<TaskStatus | null>(null)
  const [draft, setDraft] = useState('')
  const createTask = useOpMutation<Record<string, unknown>, Task>('task.create', {
    onSuccess: () => {
      setDraft('')
      setAdding(null)
    },
  })

  const tasks = data?.items ?? []
  const byStatus = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>()
    for (const col of COLUMNS) map.set(col.status, [])
    map.set('done', [])
    for (const task of tasks) (map.get(task.status) ?? map.get('next')!).push(task)
    return map
  }, [tasks])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const activeTask = tasks.find((t) => t.id === activeId) ?? null

  const onDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id))

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const task = tasks.find((t) => t.id === active.id)
    if (!task) return
    let status: TaskStatus
    let sortOrder: number
    const overId = String(over.id)
    if (overId.startsWith('col:')) {
      status = overId.slice(4) as TaskStatus
      const list = byStatus.get(status) ?? []
      sortOrder = (list[list.length - 1]?.sortOrder ?? 0) + 1024
    } else {
      const overTask = tasks.find((t) => t.id === overId)
      if (!overTask) return
      status = overTask.status
      sortOrder = overTask.sortOrder - 1
    }
    if (status === task.status && sortOrder === task.sortOrder) return
    move.mutate({ id: task.id, status, sortOrder })
  }

  const createInColumn = (status: TaskStatus) => {
    if (!draft.trim()) return
    createTask.mutate({
      title: draft.trim(),
      status,
      projectId: projectId || null,
      scheduledDate: status === 'doing' ? todayIso() : null,
    })
  }

  return (
    <div className="page page-wide">
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div>
          <h1>看板</h1>
          <p className="page-sub">
            {tasks.filter((t) => t.status !== 'done').length} 项进行中的工作
            {byStatus.get('doing')?.length ? ` · ${byStatus.get('doing')!.length} 项正在进行` : ''}
          </p>
        </div>
        <div className="head-right">
          <select className="field" style={{ width: 160 }} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">全部项目</option>
            {(projects ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => setShowDone((v) => !v)}>
            {showDone ? '收起已完成' : `已完成 ${byStatus.get('done')?.length ?? 0}`}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="kanban">
          {COLUMNS.map((col) => (
            <div className="kb-col" key={col.status}>
              <div className="skeleton" style={{ height: 20, width: 90, marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 64, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 64 }} />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Projector size={20} />}
            title="看板还是空的"
            description="把任务放进「下一步」，开始拖动它们，看看工作是怎么流动的。"
            action={
              <button className="btn primary" onClick={() => setAdding('next')}>
                <Plus size={14} /> 添加第一张卡片
              </button>
            }
          />
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="kanban">
            {COLUMNS.map((col) => {
              const list = byStatus.get(col.status) ?? []
              return (
                <Column
                  key={col.status}
                  id={col.status}
                  label={col.label}
                  tone={col.tone}
                  count={list.length}
                  onAdd={() => {
                    setAdding(col.status)
                    setDraft('')
                  }}
                  adding={adding === col.status}
                  draft={draft}
                  setDraft={setDraft}
                  onSubmit={() => createInColumn(col.status)}
                  onCancel={() => setAdding(null)}
                  creating={createTask.isPending}
                >
                  <SortableContext items={list.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    {list.map((task) => (
                      <BoardCard key={task.id} task={task} onOpen={() => openTask(task.id)} />
                    ))}
                  </SortableContext>
                  {list.length === 0 && !adding && (
                    <div className="kb-empty">把任务拖到这里，或点击 + 添加</div>
                  )}
                </Column>
              )
            })}
            {showDone && (
              <Column
                id="done"
                label="已完成"
                tone="var(--success)"
                count={byStatus.get('done')?.length ?? 0}
                onAdd={() => undefined}
                adding={false}
                draft=""
                setDraft={() => undefined}
                onSubmit={() => undefined}
                onCancel={() => undefined}
              >
                {byStatus.get('done')?.slice(0, 30).map((task) => (
                  <BoardCard key={task.id} task={task} onOpen={() => openTask(task.id)} disabled />
                ))}
              </Column>
            )}
          </div>
          <DragOverlay>
            {activeTask ? (
              <div className="kb-card" style={{ width: 250, transform: 'rotate(1.2deg)' }}>
                <div className="kb-card-title">{activeTask.title}</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}

function Column({
  id,
  label,
  tone,
  count,
  onAdd,
  adding,
  draft,
  setDraft,
  onSubmit,
  onCancel,
  creating,
  children,
}: {
  id: string
  label: string
  tone: string
  count: number
  onAdd: () => void
  adding: boolean
  draft: string
  setDraft: (v: string) => void
  onSubmit: () => void
  onCancel: () => void
  creating?: boolean
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${id}` })
  return (
    <div className="kb-col" ref={setNodeRef} style={isOver ? { background: 'var(--accent-softer)', borderColor: 'var(--accent)' } : undefined}>
      <div className="kb-head">
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: tone }} />
        {label}
        <span className="kb-count">{count}</span>
        <button className="kb-plus" onClick={onAdd} title={`在${label}中添加任务`}>
          <Plus size={14} />
        </button>
      </div>
      {adding && (
        <div style={{ marginBottom: 8 }}>
          <input
            className="field"
            autoFocus
            placeholder="任务标题，Enter 保存"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSubmit()
              if (event.key === 'Escape') onCancel()
            }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button className="btn primary sm" onClick={onSubmit} disabled={!draft.trim() || creating}>
              {creating ? '保存中…' : '添加'}
            </button>
            <button className="btn sm" onClick={onCancel}>
              取消
            </button>
          </div>
        </div>
      )}
      <div className="kb-list">{children}</div>
    </div>
  )
}

function BoardCard({ task, onOpen, disabled }: { task: Task; onOpen: () => void; disabled?: boolean }) {
  const complete = useOpMutation<{ id: string }, Task>('task.complete', { silent: true })
  const reopen = useOpMutation<{ id: string }, Task>('task.reopen', { silent: true })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled,
  })
  const due = task.dueDate ? dateBadge(task.dueDate) : null
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`kb-card ${isDragging ? 'is-dragging' : ''}`}
      onClick={onOpen}
      {...attributes}
      {...listeners}
    >
      <div className="kb-card-top">
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <PriorityFlag priority={task.priority} size={11} />
          {task.estimateMinutes ? (
            <span className="icon-pill">{formatDuration(task.estimateMinutes)}</span>
          ) : null}
        </span>
        <StatusButton
          status={task.status}
          size={13}
          onClick={() =>
            task.status === 'done' ? reopen.mutate({ id: task.id }) : complete.mutate({ id: task.id })
          }
        />
      </div>
      <div className="kb-card-title">{task.title}</div>
      <div className="kb-card-meta">
        <ProjectChip name={task.projectName} color={task.projectColor} />
        {task.dueDate && (
          <span className={due?.tone === 'danger' ? 'overdue-text' : ''} style={{ marginLeft: 'auto' }}>
            {due?.text}
          </span>
        )}
        {!task.dueDate && task.scheduledDate && <span style={{ marginLeft: 'auto' }}>{task.scheduledDate === todayIso() ? '今天' : dateBadge(task.scheduledDate).text}</span>}
      </div>
    </div>
  )
}
