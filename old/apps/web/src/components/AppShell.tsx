import { useEffect } from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChartNoAxesColumn, Columns3, FileText, Sun, Plus } from 'lucide-react'
import type { Settings } from '@daily/contracts'
import { useOp } from '@/lib/query'
import { applySettings, watchSystemTheme } from '@/lib/theme'
import { useUi } from '@/stores/ui'
import { useTimer } from '@/stores/timer'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { TaskDrawer } from './TaskDrawer'
import { CommandPalette } from './CommandPalette'
import { NewTaskModal } from './NewTaskModal'
import { ToastHost } from './ToastHost'
import { AIChatPanel } from './AIChatPanel'

const BOTTOM_NAV = [
  { to: '/today', label: '今天', icon: Sun },
  { to: '/calendar', label: '日历', icon: CalendarDays },
  { to: '/board', label: '看板', icon: Columns3 },
  { to: '/docs', label: '文档', icon: FileText },
  { to: '/dashboard', label: '仪表盘', icon: ChartNoAxesColumn },
] as const

export function AppShell() {
  const collapsed = useUi((s) => s.sidebarCollapsed)
  const setPalette = useUi((s) => s.setPalette)
  const setNewTask = useUi((s) => s.setNewTask)
  const closeDrawer = useUi((s) => s.closeDrawer)
  const setAiOpen = useUi((s) => s.setAiOpen)
  const queryClient = useQueryClient()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { data: settings } = useOp<Settings>('settings.get', {}, { staleTime: 60_000 })
  const initTimer = useTimer((s) => s.init)

  useEffect(() => {
    if (!settings) return
    applySettings(settings)
    return watchSystemTheme(settings.theme)
  }, [settings])

  useEffect(() => {
    void initTimer()
  }, [initTimer])

  useEffect(() => {
    const events = new EventSource('/api/events')
    events.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string }
        if (payload.type === 'op') {
          void queryClient.invalidateQueries()
        }
      } catch {
        // ignore malformed events
      }
    }
    return () => events.close()
  }, [queryClient])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPalette(true)
      }
      if (meta && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        setNewTask(true)
      }
      if (meta && event.key.toLowerCase() === 'j') {
        event.preventDefault()
        setAiOpen(true)
      }
      if (event.key === 'Escape') {
        closeDrawer()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeDrawer, setAiOpen, setNewTask, setPalette])

  return (
    <div className={`app ${collapsed ? 'is-collapsed' : ''}`}>
      <Sidebar />
      <div className="workspace">
        <TopBar />
        <main className="content" key={pathname}>
          <Outlet />
        </main>
      </div>
      <nav className="bottom-nav" aria-label="移动端导航">
        {BOTTOM_NAV.map((item) => {
          const Icon = item.icon
          const active = pathname === item.to || pathname.startsWith(item.to + '/')
          return (
            <Link key={item.to} to={item.to} className={active ? 'active' : ''}>
              <Icon size={19} strokeWidth={1.8} />
              <span>{item.label}</span>
            </Link>
          )
        })}
        <button
          className="icon-btn"
          style={{ border: 'none', background: 'transparent', flex: 'none', width: 44, height: 'auto' }}
          onClick={() => setNewTask(true)}
          aria-label="新建任务"
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'var(--accent)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Plus size={18} />
          </span>
        </button>
      </nav>
      <TaskDrawer />
      <AIChatPanel />
      <CommandPalette />
      <NewTaskModal />
      <ToastHost />
    </div>
  )
}
