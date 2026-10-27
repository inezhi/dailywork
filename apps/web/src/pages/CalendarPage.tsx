import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarEvent, Task } from '@daily/contracts'
import { useOp } from '@/lib/query'
import { useUi } from '@/stores/ui'
import { QuickAdd } from '@/components/QuickAdd'
import {
  addDays,
  dateRange,
  endOfWeek,
  fullDateLabel,
  monthGrid,
  monthLabel,
  startOfWeek,
  todayIso,
  weekdayLabel,
} from '@/lib/format'

type View = 'month' | 'week' | 'day'

interface DayPlan {
  date: string
  capacityMinutes: number
  plannedMinutes: number
  completedMinutes: number
  tasks: Task[]
}

const WEEKDAY_NAMES = ['一', '二', '三', '四', '五', '六', '日']

export function CalendarPage() {
  const today = todayIso()
  const [view, setView] = useState<View>('month')
  const [anchor, setAnchor] = useState(today)
  const [selected, setSelected] = useState(today)
  const [showCompleted, setShowCompleted] = useState(false)
  const { data } = useOp<{ events: CalendarEvent[] }>(
    'calendar.range',
    { from: fromFor(view, anchor), to: toFor(view, anchor), includeCompleted: showCompleted },
    { staleTime: 20_000 },
  )
  const { data: dayPlan } = useOp<DayPlan>('day.get', { date: selected })
  const openTask = useUi((s) => s.openTask)

  const events = data?.events ?? []
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const list = map.get(event.date) ?? []
      list.push(event)
      map.set(event.date, list)
    }
    for (const [date, list] of map) {
      const seen = new Set<string>()
      const sorted = [...list].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'scheduled' ? -1 : 1
        return (a.time ?? '99:99').localeCompare(b.time ?? '99:99')
      })
      const deduped = sorted.filter((event) => {
        const key = `${event.task.id}:${event.kind === 'due' ? 'd' : 's'}`
        if (event.kind === 'due' && sorted.some((e) => e.kind === 'scheduled' && e.task.id === event.task.id)) {
          return false
        }
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      map.set(date, deduped)
    }
    return map
  }, [events])

  const step = (direction: -1 | 1) => {
    if (view === 'month') {
      const d = new Date(anchor)
      d.setMonth(d.getMonth() + direction)
      const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      setAnchor(next)
      setSelected(next)
    } else if (view === 'week') {
      const next = addDays(anchor, direction * 7)
      setAnchor(next)
      setSelected(next)
    } else {
      const next = addDays(anchor, direction)
      setAnchor(next)
      setSelected(next)
    }
  }

  const selectedEvents = byDate.get(selected) ?? []
  const days = view === 'month' ? monthGrid(anchor) : view === 'week' ? dateRange(startOfWeek(anchor), endOfWeek(anchor)) : [anchor]

  return (
    <div className="page page-wide">
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div>
          <h1>日历</h1>
          <p className="page-sub">
            {fullDateLabel(selected)} · 已安排 {dayPlan?.plannedMinutes ?? 0} / {dayPlan?.capacityMinutes ?? 0} 分钟
          </p>
        </div>
        <div className="head-right">
          <button className="btn" onClick={() => setShowCompleted((v) => !v)}>
            {showCompleted ? '隐藏已完成' : '显示已完成'}
          </button>
          <div className="seg">
            <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>
              月
            </button>
            <button className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>
              周
            </button>
            <button className={view === 'day' ? 'on' : ''} onClick={() => setView('day')}>
              日
            </button>
          </div>
        </div>
      </div>

      <div className="cal-layout">
        <div className="cal-main">
          <div className="cal-head">
            <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => step(-1)} aria-label="上一个">
              <ChevronLeft size={15} />
            </button>
            <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => step(1)} aria-label="下一个">
              <ChevronRight size={15} />
            </button>
            <b style={{ fontSize: 14, marginLeft: 4 }}>
              {view === 'day' ? fullDateLabel(anchor) : monthLabel(view === 'week' ? startOfWeek(anchor) : anchor)}
            </b>
            <button
              className="btn sm"
              style={{ marginLeft: 'auto' }}
              onClick={() => {
                setAnchor(today)
                setSelected(today)
              }}
            >
              今天
            </button>
          </div>

          {view === 'month' && (
            <>
              <div className="cal-weekdays">
                {WEEKDAY_NAMES.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="cal-grid">
                {monthGrid(anchor).map((date) => {
                  const dateEvents = byDate.get(date) ?? []
                  const isOther = date.slice(0, 7) !== anchor.slice(0, 7)
                  return (
                    <div
                      key={date}
                      className={`cal-cell ${isOther ? 'other' : ''} ${date === today ? 'today' : ''} ${date === selected ? 'selected' : ''}`}
                      onClick={() => setSelected(date)}
                    >
                      <span className="cal-num">{Number(date.slice(8))}</span>
                      <div className="cal-events">
                        {dateEvents.slice(0, 3).map((event) => (
                          <button
                            key={`${event.task.id}-${event.kind}`}
                            className={`cal-ev ${event.kind === 'due' ? 'due' : ''}`}
                            style={{ ['--space-color' as string]: event.task.spaceColor ?? 'var(--accent)' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              openTask(event.task.id)
                            }}
                            title={event.task.title}
                          >
                            {event.time && <span className="tnum" style={{ color: 'var(--ink-3)' }}>{event.time}</span>}
                            <span className="ev-dot" />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.task.title}</span>
                          </button>
                        ))}
                        {dateEvents.length > 3 && <span className="cal-more">+{dateEvents.length - 3}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {view === 'week' && (
            <div className="cal-week-cols">
              {days.map((date) => {
                const dateEvents = byDate.get(date) ?? []
                return (
                  <div className="cal-week-col" key={date} onClick={() => setSelected(date)}>
                    <div className={`cal-week-head ${date === today ? 'today' : ''}`}>
                      {weekdayLabel(date)}
                      <b>{Number(date.slice(8))}</b>
                    </div>
                    <div className="cal-week-body">
                      {dateEvents.map((event) => (
                        <button
                          key={`${event.task.id}-${event.kind}`}
                          className={`cal-week-ev ${event.kind === 'due' ? 'due' : ''}`}
                          style={{ ['--space-color' as string]: event.task.spaceColor ?? 'var(--accent)' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            openTask(event.task.id)
                          }}
                        >
                          {event.time && <span className="time">{event.time}</span>}
                          {event.task.title}
                        </button>
                      ))}
                      {dateEvents.length === 0 && (
                        <span style={{ fontSize: 9, color: 'var(--ink-4)', textAlign: 'center', padding: 6 }}>—</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {view === 'day' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
              {selectedEvents.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 12, padding: 60 }}>
                  这一天还没有安排。右侧添加一件小事，让时间有个落点。
                </div>
              ) : (
                selectedEvents.map((event) => (
                  <button
                    key={`${event.task.id}-${event.kind}`}
                    className="agenda-item"
                    onClick={() => openTask(event.task.id)}
                    style={{ padding: '14px 8px' }}
                  >
                    <span className="agenda-time">{event.time ?? (event.kind === 'due' ? '截止' : '全天')}</span>
                    <span style={{ flex: 1 }}>
                      <span className="agenda-title" style={{ fontSize: 14 }}>{event.task.title}</span>
                      <span className="agenda-meta">
                        {event.task.projectName ?? '未归类'} · {event.task.estimateMinutes ?? 0} 分钟
                      </span>
                    </span>
                    <span className={`chip ${event.kind === 'due' ? 'soft' : 'project'}`} style={{ ['--chip-color' as string]: event.task.spaceColor ?? 'var(--accent)' }}>
                      {event.kind === 'due' ? '截止' : '计划'}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <aside className="agenda">
          <div className="agenda-head">
            <div>
              <div className="eyebrow">{weekdayLabel(selected)}</div>
              <h3>{Number(selected.slice(8))} 日</h3>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="eyebrow">容量</div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 3 }}>
                {dayPlan?.plannedMinutes ?? 0}/{dayPlan?.capacityMinutes ?? 0} 分钟
              </div>
            </div>
          </div>
          <div className="agenda-list">
            {selectedEvents.map((event) => (
              <button
                key={`${event.task.id}-${event.kind}`}
                className="agenda-item"
                onClick={() => openTask(event.task.id)}
              >
                <span className="agenda-time">{event.time ?? (event.kind === 'due' ? '截止' : '全天')}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="agenda-title" style={{ display: 'block' }}>{event.task.title}</span>
                  <span className="agenda-meta">
                    {event.task.projectName ?? '未归类'}
                    {event.task.estimateMinutes ? ` · ${event.task.estimateMinutes} 分钟` : ''}
                  </span>
                </span>
                {event.kind === 'due' && <span className="chip soft" style={{ color: 'var(--danger)' }}>截止</span>}
              </button>
            ))}
            {selectedEvents.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--ink-3)', padding: '16px 2px' }}>这一天是空的。</div>
            )}
          </div>
          <div style={{ marginTop: 10 }}>
            <QuickAdd defaults={{ scheduledDate: selected }} placeholder="加入这一天…" />
          </div>
        </aside>
      </div>
    </div>
  )
}

function fromFor(view: View, anchor: string): string {
  if (view === 'month') return monthGrid(anchor)[0]!
  if (view === 'week') return startOfWeek(anchor)
  return anchor
}

function toFor(view: View, anchor: string): string {
  if (view === 'month') return monthGrid(anchor)[41]!
  if (view === 'week') return endOfWeek(anchor)
  return anchor
}
