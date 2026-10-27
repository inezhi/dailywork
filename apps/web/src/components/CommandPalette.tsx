import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  CalendarDays,
  ChartNoAxesColumn,
  Columns3,
  FileText,
  Inbox,
  ListTodo,
  Plus,
  Search,
  StickyNote,
  Sun,
  Timer,
} from 'lucide-react'
import type { SearchHit } from '@daily/contracts'
import { useOp } from '@/lib/query'
import { useUi } from '@/stores/ui'
import { useTimer } from '@/stores/timer'

const NAV_ITEMS = [
  { label: '今天', to: '/today', icon: Sun },
  { label: '收件箱', to: '/inbox', icon: Inbox },
  { label: '全部任务', to: '/tasks', icon: ListTodo },
  { label: '看板', to: '/board', icon: Columns3 },
  { label: '日历', to: '/calendar', icon: CalendarDays },
  { label: '时间轴', to: '/timeline', icon: GanttShortcut },
  { label: '专注', to: '/focus', icon: Timer },
  { label: '文档', to: '/docs', icon: FileText },
  { label: '速记', to: '/memos', icon: StickyNote },
  { label: '仪表盘', to: '/dashboard', icon: ChartNoAxesColumn },
] as const

function GanttShortcut(props: { size?: number }) {
  return <CalendarDays {...props} />
}

interface Item {
  key: string
  label: string
  hint?: string
  icon: React.ReactNode
  run: () => void
}

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen)
  const setOpen = useUi((s) => s.setPalette)
  const setNewTask = useUi((s) => s.setNewTask)
  const openTask = useUi((s) => s.openTask)
  const navigate = useNavigate()
  const timer = useTimer()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setDebounced('')
    setCursor(0)
    setTimeout(() => inputRef.current?.focus(), 30)
  }, [open])

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 180)
    return () => clearTimeout(timer)
  }, [query])

  const { data: hits } = useOp<SearchHit[]>('search.all', { query: debounced, limit: 20 }, {
    enabled: open && debounced.length > 0,
  })

  const items = useMemo<Item[]>(() => {
    const list: Item[] = []
    if (debounced.length === 0) {
      if (!timer.session) {
        list.push({
          key: 'action:new',
          label: '新建任务',
          hint: '⌘N',
          icon: <Plus size={14} />,
          run: () => {
            setOpen(false)
            setNewTask(true)
          },
        })
      }
      for (const item of NAV_ITEMS) {
        const Icon = item.icon
        list.push({
          key: `nav:${item.to}`,
          label: item.label,
          hint: '页面',
          icon: <Icon size={14} />,
          run: () => {
            setOpen(false)
            void navigate({ to: item.to })
          },
        })
      }
      return list
    }
    for (const hit of hits ?? []) {
      list.push({
        key: `${hit.kind}:${hit.id}`,
        label: hit.title,
        hint:
          hit.kind === 'task'
            ? '任务'
            : hit.kind === 'document'
              ? '文档'
              : hit.kind === 'memo'
                ? '速记'
                : '项目',
        icon:
          hit.kind === 'task' ? (
            <ListTodo size={14} />
          ) : hit.kind === 'document' ? (
            <FileText size={14} />
          ) : hit.kind === 'memo' ? (
            <StickyNote size={14} />
          ) : (
            <ArrowRight size={14} />
          ),
        run: () => {
          setOpen(false)
          if (hit.kind === 'task') openTask(hit.id)
          else if (hit.kind === 'document') void navigate({ to: '/docs/$docId', params: { docId: hit.id } })
          else if (hit.kind === 'project')
            void navigate({ to: '/projects/$projectId', params: { projectId: hit.id } })
          else void navigate({ to: '/memos' })
        },
      })
    }
    return list
  }, [debounced, hits, navigate, openTask, setNewTask, setOpen, timer.session])

  if (!open) return null

  return createPortal(
    <div
      className="modal-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false)
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="全局搜索">
        <div className="palette-input">
          <Search size={16} color="var(--ink-3)" />
          <input
            ref={inputRef}
            value={query}
            placeholder="搜索任务、文档、速记、项目…"
            onChange={(event) => {
              setQuery(event.target.value)
              setCursor(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false)
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setCursor((c) => Math.min(items.length - 1, c + 1))
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setCursor((c) => Math.max(0, c - 1))
              }
              if (event.key === 'Enter' && items[cursor]) {
                event.preventDefault()
                items[cursor]!.run()
              }
            }}
          />
          <kbd className="kbd">ESC</kbd>
        </div>
        <div className="palette-results">
          {debounced && items.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
              没有找到「{debounced}」
            </div>
          )}
          {items.map((item, index) => (
            <button
              key={item.key}
              className={`palette-item ${index === cursor ? 'on' : ''}`}
              onMouseEnter={() => setCursor(index)}
              onClick={item.run}
            >
              <span style={{ color: 'var(--ink-3)', display: 'flex' }}>{item.icon}</span>
              <span>{item.label}</span>
              <span className="kind">{item.hint}</span>
            </button>
          ))}
        </div>
        <div className="palette-foot">
          <span>↑↓ 选择</span>
          <span>↵ 打开</span>
          <span>⌘K 关闭</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
