import { useMemo, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { Search, SlidersHorizontal } from 'lucide-react'
import type { ListResult, Project, Task, TaskStatus } from '@daily/contracts'
import { useOp } from '@/lib/query'
import { TaskRow } from '@/components/TaskRow'
import { QuickAdd } from '@/components/QuickAdd'
import { EmptyState } from '@/components/EmptyState'
import { ListTodo } from 'lucide-react'
import { STATUS_LABEL, STATUS_ORDER } from '@/lib/format'

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

      {groups.map(({ status, tasks }) =>
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
