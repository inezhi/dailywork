import { useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  ChartNoAxesColumn,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  FileText,
  FolderKanban,
  GanttChart,
  Inbox,
  ListTodo,
  Plus,
  Settings,
  StickyNote,
  Sun,
  Timer,
} from 'lucide-react'
import type { Project, Space, TodayResult, CreateProjectInput, CreateSpaceInput } from '@daily/contracts'
import { useOp, useOpMutation } from '@/lib/query'
import { useUi } from '@/stores/ui'
import { FocusRing } from './FocusRing'
import { Modal, ModalHeader } from './Modal'
import { toast } from '@/stores/toast'

const NAV = [
  { to: '/today', label: '今天', icon: Sun },
  { to: '/inbox', label: '收件箱', icon: Inbox },
  { to: '/tasks', label: '全部任务', icon: ListTodo },
  { to: '/board', label: '看板', icon: Columns3 },
  { to: '/calendar', label: '日历', icon: CalendarDays },
  { to: '/timeline', label: '时间轴', icon: GanttChart },
  { to: '/focus', label: '专注', icon: Timer },
  { to: '/docs', label: '文档', icon: FileText },
  { to: '/memos', label: '速记', icon: StickyNote },
  { to: '/dashboard', label: '仪表盘', icon: ChartNoAxesColumn },
] as const

const PROJECT_COLORS = ['#D97757', '#5E7D6B', '#6A8CAF', '#B5514A', '#B08A4C', '#7C6C8A']

export function Sidebar() {
  const collapsed = useUi((s) => s.sidebarCollapsed)
  const toggle = useUi((s) => s.toggleSidebar)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { data: spaces } = useOp<Space[]>('space.list')
  const { data: projects } = useOp<Project[]>('project.list', {})
  const { data: today } = useOp<TodayResult>('today.get', {}, { staleTime: 30_000 })
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [newSpaceOpen, setNewSpaceOpen] = useState(false)

  const totalToday = today ? today.scheduled.length : 0
  const doneToday = today ? today.scheduled.filter((t) => t.status === 'done').length : 0
  const progress = totalToday === 0 ? 0 : doneToday / totalToday

  return (
    <aside className="sidebar" aria-label="主导航">
      <div className="brand">
        <Link to="/today" className="brand-mark" aria-label="时序首页">
          <img src="/logo.png" alt="时序标识" />
        </Link>
        <div className="brand-copy">
          <div className="brand-name">时序</div>
          <div className="brand-sub">DAILYWORK</div>
        </div>
        <button className="brand-collapse" onClick={toggle} title={collapsed ? '展开侧栏' : '收起侧栏'}>
          {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
        </button>
      </div>

      <nav className="nav">
        {NAV.map((item) => {
          const Icon = item.icon
          const active = pathname === item.to || pathname.startsWith(item.to + '/')
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`nav-item ${active ? 'active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={16} strokeWidth={1.8} />
              <span className="label nav-truncate">{item.label}</span>
              {item.to === '/inbox' && today && today.inboxCount > 0 && (
                <span className="nav-count accent">{today.inboxCount}</span>
              )}
              {item.to === '/today' && today && today.scheduled.length > 0 && (
                <span className="nav-count">{today.scheduled.length}</span>
              )}
            </Link>
          )
        })}

        <div className="nav-label">
          <span>空间</span>
          <button onClick={() => setNewSpaceOpen(true)} title="新建空间" aria-label="新建空间">
            <Plus size={13} />
          </button>
        </div>
        {spaces?.map((space) => (
          <Link
            key={space.id}
            to="/tasks"
            search={{ space: space.id }}
            className="nav-item"
            style={{ paddingLeft: 10 }}
            title={space.name}
          >
            <span className="space-dot" style={{ background: space.color }} />
            <span className="label nav-truncate">{space.name}</span>
            <span className="nav-count">{space.openTaskCount ?? 0}</span>
          </Link>
        ))}

        <div className="nav-label">
          <span>项目</span>
          <button onClick={() => setNewProjectOpen(true)} title="新建项目" aria-label="新建项目">
            <Plus size={13} />
          </button>
        </div>
        {(projects ?? []).slice(0, 7).map((project) => (
          <Link
            key={project.id}
            to="/projects/$projectId"
            params={{ projectId: project.id }}
            className={`nav-item ${pathname === `/projects/${project.id}` ? 'active' : ''}`}
            title={project.name}
          >
            <span className="space-dot" style={{ background: project.color }} />
            <span className="label nav-truncate">{project.name}</span>
            <span className="nav-count">{project.taskTotal ?? 0}</span>
          </Link>
        ))}
        {(projects ?? []).length === 0 && (
          <button className="nav-item" onClick={() => setNewProjectOpen(true)} style={{ color: 'var(--ink-3)' }}>
            <FolderKanban size={16} />
            <span className="label">创建第一个项目</span>
          </button>
        )}
      </nav>

      <div className="sidebar-foot">
        <Link to="/dashboard" className="side-progress">
          <FocusRing
            size={38}
            stroke={4}
            value={progress}
            label={
              <span style={{ fontSize: 9, fontWeight: 700 }}>
                {totalToday ? `${Math.round(progress * 100)}%` : '—'}
              </span>
            }
            tone="accent"
          />
          <div className="side-progress-copy">
            <div className="side-progress-title">今日进度</div>
            <div className="side-progress-sub">
              {doneToday}/{totalToday} 项 · 专注 {today?.focusMinutes ?? 0} 分钟
            </div>
          </div>
        </Link>
        <Link to="/settings" className={`nav-item ${pathname === '/settings' ? 'active' : ''}`} style={{ marginTop: 8 }}>
          <Settings size={16} strokeWidth={1.8} />
          <span className="label">设置</span>
        </Link>
      </div>

      <NewProjectModal open={newProjectOpen} onClose={() => setNewProjectOpen(false)} spaces={spaces ?? []} />
      <NewSpaceModal open={newSpaceOpen} onClose={() => setNewSpaceOpen(false)} />
    </aside>
  )
}

function NewProjectModal({
  open,
  onClose,
  spaces,
}: {
  open: boolean
  onClose: () => void
  spaces: Space[]
}) {
  const [name, setName] = useState('')
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? '')
  const [color, setColor] = useState(PROJECT_COLORS[0]!)
  const navigate = useNavigate()
  const create = useOpMutation<CreateProjectInput, Project>('project.create', {
    onSuccess: (project) => {
      toast.success('项目已创建')
      setName('')
      onClose()
      void navigate({ to: '/projects/$projectId', params: { projectId: project.id } })
    },
  })

  return (
    <Modal open={open} onClose={onClose} label="新建项目">
      <ModalHeader title="新建项目" description="项目把相关任务聚在一起，并追踪进度。" onClose={onClose} />
      <div className="modal-body">
        <div className="form-row">
          <label>项目名称</label>
          <input
            className="field"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：发布 1.0"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && name.trim()) {
                create.mutate({ name: name.trim(), spaceId: spaceId || undefined, color })
              }
            }}
          />
        </div>
        <div className="form-row">
          <label>所属空间</label>
          <select className="field" value={spaceId} onChange={(event) => setSpaceId(event.target.value)}>
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>颜色</label>
          <div className="swatches">
            {PROJECT_COLORS.map((value) => (
              <button
                key={value}
                type="button"
                className={`swatch ${color === value ? 'on' : ''}`}
                style={{ background: value }}
                onClick={() => setColor(value)}
                aria-label={`选择颜色 ${value}`}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>
          取消
        </button>
        <button
          className="btn primary"
          disabled={!name.trim() || create.isPending}
          onClick={() => create.mutate({ name: name.trim(), spaceId: spaceId || undefined, color })}
        >
          {create.isPending ? '创建中…' : '创建项目'}
        </button>
      </div>
    </Modal>
  )
}


function NewSpaceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PROJECT_COLORS[0]!)
  const create = useOpMutation<CreateSpaceInput, Space>('space.create', {
    onSuccess: () => {
      toast.success('空间已创建')
      setName('')
      onClose()
    },
  })
  return (
    <Modal open={open} onClose={onClose} label="新建空间">
      <ModalHeader title="新建空间" description="空间是项目与任务的第一层归组，例如工作、学习、生活。" onClose={onClose} />
      <div className="modal-body">
        <div className="form-row">
          <label>空间名称</label>
          <input
            className="field"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：学习"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && name.trim()) create.mutate({ name: name.trim(), color, icon: 'layers' })
            }}
          />
        </div>
        <div className="form-row">
          <label>颜色</label>
          <div className="swatches">
            {PROJECT_COLORS.map((value) => (
              <button
                key={value}
                type="button"
                className={`swatch ${color === value ? 'on' : ''}`}
                style={{ background: value }}
                onClick={() => setColor(value)}
                aria-label={`选择颜色 ${value}`}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>取消</button>
        <button className="btn primary" disabled={!name.trim() || create.isPending} onClick={() => create.mutate({ name: name.trim(), color, icon: 'layers' })}>
          {create.isPending ? '创建中…' : '创建空间'}
        </button>
      </div>
    </Modal>
  )
}
