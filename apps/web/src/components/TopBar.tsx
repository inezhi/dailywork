import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Moon, Plus, Search, Sparkles, Sun, Timer } from 'lucide-react'
import type { Settings } from '@daily/contracts'
import { useOp, useOpMutation } from '@/lib/query'
import { useUi } from '@/stores/ui'
import { useTimer } from '@/stores/timer'
import { effectiveMode } from '@/lib/theme'
import { FocusRing } from './FocusRing'
import { formatClock } from '@/lib/format'

const CRUMBS: Record<string, string> = {
  '/today': '今天',
  '/inbox': '收件箱',
  '/tasks': '全部任务',
  '/board': '看板',
  '/calendar': '日历',
  '/timeline': '时间轴',
  '/focus': '专注',
  '/docs': '文档',
  '/memos': '速记',
  '/dashboard': '仪表盘',
  '/settings': '设置',
  '/design': '设计系统',
}

export function TopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const setPalette = useUi((s) => s.setPalette)
  const setNewTask = useUi((s) => s.setNewTask)
  const openAi = useUi((s) => s.openAi)
  const { data: settings } = useOp<Settings>('settings.get')
  const update = useOpMutation<{ theme: Partial<Settings['theme']> }, Settings>('settings.update', {
    silent: true,
  })
  const timer = useTimer()
  const navigate = useNavigate()

  const crumb =
    CRUMBS[pathname] ??
    (pathname.startsWith('/projects/')
      ? '项目'
      : pathname.startsWith('/docs/')
        ? '文档'
        : '时序')

  const mode = settings ? effectiveMode(settings.theme.mode) : 'light'
  const toggleTheme = () => {
    if (!settings) return
    update.mutate({ theme: { mode: mode === 'dark' ? 'light' : 'dark' } })
  }

  const timerProgress =
    timer.session && timer.totalSeconds > 0
      ? 1 - timer.remainingSeconds / timer.totalSeconds
      : 0

  return (
    <header className="topbar">
      <div className="crumb">
        <Link to="/today" style={{ color: 'var(--ink-3)' }}>
          时序
        </Link>
        <span>/</span>
        <b>{crumb}</b>
      </div>

      <button className="top-search" onClick={() => setPalette(true)}>
        <Search size={14} />
        <span style={{ flex: 1, textAlign: 'left' }}>搜索任务、文档、速记…</span>
        <kbd>⌘K</kbd>
      </button>

      <div className="top-actions">
        {timer.session && (
          <button
            className="icon-btn"
            onClick={() => void navigate({ to: '/focus' })}
            title="进行中的专注"
            style={{ width: 'auto', padding: '0 8px 0 4px', gap: 6, display: 'flex' }}
          >
            <FocusRing
              size={24}
              stroke={3}
              value={timerProgress}
              label={
                <span style={{ fontSize: 6.5, fontWeight: 700 }}>
                  {Math.round(timerProgress * 100)}
                </span>
              }
            />
            <span className="tnum" style={{ fontSize: 10.5, color: 'var(--ink-2)' }}>
              {formatClock(timer.remainingSeconds)}
            </span>
            <Timer size={12} color="var(--ink-3)" />
          </button>
        )}
        <button className="icon-btn" onClick={() => openAi()} title="AI 助理（⌘J）" aria-label="AI 助理">
          <Sparkles size={15} />
        </button>
        <button className="icon-btn hide-mobile" onClick={toggleTheme} title="切换深浅主题">
          {mode === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button className="btn primary" onClick={() => setNewTask(true)}>
          <Plus size={14} />
          <span className="hide-mobile">新建任务</span>
        </button>
        <div className="avatar" title="本地账户">
          我
        </div>
      </div>
    </header>
  )
}
