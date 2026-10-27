import { useMemo, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { Grid2X2, List, Search, SlidersHorizontal } from 'lucide-react'
import type { ListResult, Project, Task, TaskStatus } from '@daily/contracts'
import { useOp, useOpMutation } from '@/lib/query'
import { useUi } from '@/stores/ui'
import { toast } from '@/stores/toast'
import { TaskRow } from '@/components/TaskRow'
import { QuickAdd } from '@/components/QuickAdd'
import { EmptyState } from '@/components/EmptyState'
import { ListTodo } from 'lucide-react'
import { addDays, dateBadge, STATUS_LABEL, STATUS_ORDER, todayIso } from '@/lib/format'

const TABS: Array<{ key: string; label: string; statuses?: TaskStatus[] }> = [
  { key: 'all', label: '全部' },
  { key: 'next', label: '下一步', statuses: ['next'] },
  { key: 'doing', label: '进行中', statuses: ['doing'] },
  { key: 'waiting', label: '等待中', statuses: ['waiting'] },
  { key: 'blocked', label: '受阻', statuses: ['blocked'] },
  { key: 'done', label: '已完成', statuses: ['done'] },
]

export function TasksPage() {
  const search = useSearch({ strict: false }) as { space?: string; project?: string }
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [projectId, setProjectId] = useState(search.project ?? '')
  const [sort, setSort] = useState<'manual' | 'scheduled' | 'due' | 'priority' | 'created'>('manual')
  const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list')
  const { data: projects } = useOp<Project[]>('project.list', {})

  const active = TABS.find((t) => t.key === tab)
  const { data, isLoading } = useOp<ListResult<Task>>('task.list', {
    status: active?.statuses,
    spaceId: search.space,
    projectId: projectId || undefined,
    search: query.trim() || undefined,
    sort,
    limit: 400,
  })

  const groups = useMemo<Array<{ status: TaskStatus; tasks: Task[] }>>(() => {
    const items = data?.items ?? []
    if (active?.statuses) return [{ status: active.statuses[0]!, tasks: items }]
    const map = new Map<string, Task[]>()
    for (const status of STATUS_ORDER) map.set(status, [])
    for (const task of items) {
      const list = map.get(task.status) ?? []
      list.push(task)
      map.set(task.status, list)
    }
    const ordered: TaskStatus[] = ['doing', 'next', 'waiting', 'blocked', 'inbox', 'done']
    return ordered.map((status) => ({ status, tasks: map.get(status) ?? [] }))
  }, [data, active])

  const openCount = (data?.items ?? []).filter((t) => t.status !== 'done').length

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>全部任务</h1>
          <p className="page-sub">
            {openCount} 项未完成
            {data ? ` · 共 ${data.total} 项` : ''}
          </p>
        </div>
        <div className="head-right">
          <div className="seg">
            <button className={viewMode === 'list' ? 'on' : ''} onClick={() => setViewMode('list')} title="列表">
              <List size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> 列表
            </button>
            <button
              className={viewMode === 'matrix' ? 'on' : ''}
              onClick={() => {
                setViewMode('matrix')
                setTab('all')
              }}
              title="四象限"
            >
              <Grid2X2 size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> 四象限
            </button>
          </div>
        </div>
      </div>

      <QuickAdd placeholder="添加任务，支持 #标签 / !2 高优先级 / @tomorrow" />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          margin: '18px 0 6px',
          flexWrap: 'wrap',
        }}
      >
        <div className="seg">
          {TABS.map((item) => (
            <button key={item.key} className={tab === item.key ? 'on' : ''} onClick={() => setTab(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="top-search" style={{ width: 190, margin: 0 }}>
            <Search size={13} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索任务"
              style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: 12 }}
            />
          </div>
          <select className="field" style={{ width: 140 }} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            <option value="">全部项目</option>
            {(projects ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            className="field"
            style={{ width: 120 }}
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
          >
            <option value="manual">手动排序</option>
            <option value="scheduled">按计划日期</option>
            <option value="due">按截止日期</option>
            <option value="priority">按优先级</option>
            <option value="created">按创建时间</option>
          </select>
        </div>
      </div>

      {isLoading && (
        <div style={{ marginTop: 18 }}>
          <div className="skeleton" style={{ height: 50, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 50, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 50 }} />
        </div>
      )}

      {!isLoading && (data?.items.length ?? 0) === 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <EmptyState
            icon={<ListTodo size={20} />}
            title={query ? '没有匹配的任务' : '这里还没有任务'}
            description={
              query
                ? '换一个关键词，或者清空筛选条件。'
                : '从上方添加一个任务。任务可以属于项目、安排在某个日期，再进入专注。'
            }
          />
        </div>
      )}

      {viewMode === 'matrix' && (
        <MatrixView tasks={(data?.items ?? []).filter((task) => task.status !== 'done')} />
      )}

      {viewMode === 'list' && groups.map(({ status, tasks }) =>
        tasks.length === 0 ? null : (
          <section key={status}>
            <div className="section-title">
              <span>{STATUS_LABEL[status]}</span>
              <span className="count">{tasks.length}</span>
              <span className="line" />
              <SlidersHorizontal size={11} style={{ opacity: 0.4 }} />
            </div>
            <div className="list-card">
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} showDate={status !== 'done'} />
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  )
}

function MatrixView({ tasks }: { tasks: Task[] }) {
  const openTask = useUi((s) => s.openTask)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const update = useOpMutation<Record<string, unknown>, Task>('task.update', {
    silent: true,
    onSuccess: () => toast.success('已调整优先级与截止日期'),
  })
  const today = todayIso()
  const soon = addDays(today, 2)
  const buckets = [
    {
      key: 'do',
      title: '重要且紧急',
      hint: '先做',
      agent: '今天',
      items: tasks.filter(
        (t) =>
          (t.priority === 'high' || t.priority === 'urgent') &&
          ((t.dueDate != null && t.dueDate <= soon) || t.priority === 'urgent'),
      ),
    },
    {
      key: 'plan',
      title: '重要不紧急',
      hint: '安排时间',
      agent: '计划',
      items: tasks.filter(
        (t) =>
          (t.priority === 'high' || t.priority === 'urgent') &&
          !((t.dueDate != null && t.dueDate <= soon) || t.priority === 'urgent'),
      ),
    },
    {
      key: 'delegate',
      title: '紧急不重要',
      hint: '尽快处理或收缩',
      agent: '本周',
      items: tasks.filter(
        (t) =>
          t.priority !== 'high' &&
          t.priority !== 'urgent' &&
          t.dueDate != null &&
          t.dueDate <= soon,
      ),
    },
    {
      key: 'later',
      title: '其他',
      hint: '有空再做',
      agent: '以后',
      items: tasks.filter(
        (t) =>
          t.priority !== 'high' &&
          t.priority !== 'urgent' &&
          !(t.dueDate != null && t.dueDate <= soon),
      ),
    },
  ]
  return (
    <div className="matrix-grid">
      {buckets.map((bucket) => (
        <section
          className={`matrix-card ${dragOver === bucket.key ? 'drag-over' : ''}`}
          key={bucket.key}
          onDragOver={(event) => {
            event.preventDefault()
            setDragOver(bucket.key)
          }}
          onDragLeave={() => setDragOver((current) => (current === bucket.key ? null : current))}
          onDrop={(event) => {
            event.preventDefault()
            setDragOver(null)
            try {
              const taskId = event.dataTransfer.getData('application/x-dailywork-task')
              if (!taskId) return
              const today = todayIso()
              const urgentDate = addDays(today, 1)
              const patch =
                bucket.key === 'do'
                  ? { priority: 'high', dueDate: urgentDate }
                  : bucket.key === 'plan'
                    ? { priority: 'high', dueDate: null }
                    : bucket.key === 'delegate'
                      ? { priority: 'low', dueDate: urgentDate }
                      : { priority: 'low', dueDate: null }
              update.mutate({ id: taskId, ...patch })
            } catch {
              // ignore
            }
          }}
        >
          <div className="matrix-head">
            <b>{bucket.title}</b>
            <span>{bucket.hint} · {bucket.items.length}</span>
            <span className="matrix-agent">{bucket.agent}</span>
          </div>
          {bucket.items.length === 0 && <div className="matrix-empty">这里是空的，很好。</div>}
          {bucket.items.map((task) => (
            <div
              key={task.id}
              className="matrix-item"
              role="button"
              tabIndex={0}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('application/x-dailywork-task', task.id)
                event.dataTransfer.effectAllowed = 'move'
              }}
              onClick={() => openTask(task.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openTask(task.id)
                }
              }}
            >
              <span className={`status-btn ${task.status}`} style={{ width: 13, height: 13 }} />
              <span className="t">{task.title}</span>
              {task.dueDate && (
                <span className={dateBadge(task.dueDate).tone === 'danger' ? 'overdue-text' : ''} style={{ fontSize: 9, color: 'var(--ink-3)' }}>
                  {dateBadge(task.dueDate).text}
                </span>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
