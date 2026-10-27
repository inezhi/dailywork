import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, GanttChart } from 'lucide-react'
import type { TimelineItem } from '@daily/contracts'
import { useOp } from '@/lib/query'
import { useUi } from '@/stores/ui'
import { EmptyState } from '@/components/EmptyState'
import { addDays, dateRange, monthLabel, startOfWeek, todayIso, weekdayLabel } from '@/lib/format'

const DAYS = 28

export function TimelinePage() {
  const today = todayIso()
  const [from, setFrom] = useState(() => startOfWeek(addDays(today, -7)))
  const to = addDays(from, DAYS - 1)
  const days = useMemo(() => dateRange(from, to), [from, to])
  const { data, isLoading } = useOp<{ items: TimelineItem[] }>('timeline.range', { from, to })
  const openTask = useUi((s) => s.openTask)

  const items = (data?.items ?? []).slice().sort((a, b) => a.start.localeCompare(b.start))

  return (
    <div className="page page-wide">
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div>
          <h1>时间轴</h1>
          <p className="page-sub">
            {monthLabel(from)} — {monthLabel(to)} · {items.length} 条任务
          </p>
        </div>
        <div className="head-right">
          <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setFrom(addDays(from, -DAYS))} aria-label="上一段">
            <ChevronLeft size={15} />
          </button>
          <button className="btn" onClick={() => setFrom(startOfWeek(addDays(today, -7)))}>
            今天
          </button>
          <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => setFrom(addDays(from, DAYS))} aria-label="下一段">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="timeline-wrap" style={{ padding: 20 }}>
          <div className="skeleton" style={{ height: 20, width: 200, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 34, marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 34, marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 34 }} />
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<GanttChart size={20} />}
            title="时间轴还是空的"
            description="给任务设置计划日期或截止日期，它们会在这里排成一条时间带。"
          />
        </div>
      ) : (
        <div className="timeline-wrap">
          <div className="timeline-head">
            <div className="timeline-label-col">任务</div>
            <div className="timeline-days" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
              {days.map((date) => (
                <div key={date} className={`timeline-day ${date === today ? 'today' : ''}`}>
                  <div>{weekdayLabel(date).replace('周', '')}</div>
                  <div style={{ fontSize: 10, marginTop: 2 }}>{Number(date.slice(8))}</div>
                </div>
              ))}
            </div>
          </div>
          {items.map((item) => {
            const startIndex = Math.max(0, days.indexOf(item.start))
            const endIndex = Math.max(startIndex, days.indexOf(item.end))
            const span = endIndex - startIndex + 1
            const todayIndex = days.indexOf(today)
            return (
              <div className="timeline-row" key={item.task.id}>
                <div className="timeline-label">
                  <span
                    className="space-dot"
                    style={{ background: item.task.spaceColor ?? 'var(--accent)', margin: 0 }}
                  />
                  <span className="t" title={item.task.title}>
                    {item.task.title}
                  </span>
                </div>
                <div
                  className="timeline-track"
                  style={{
                    gridTemplateColumns: `repeat(${days.length}, 1fr)`,
                    backgroundImage: `repeating-linear-gradient(to right, var(--line-soft) 0 1px, transparent 1px calc(100% / ${days.length}))`,
                  }}
                >
                  {todayIndex >= 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${(todayIndex / days.length) * 100}%`,
                        width: 1,
                        background: 'color-mix(in oklab, var(--accent) 45%, transparent)',
                      }}
                    />
                  )}
                  <button
                    className={`timeline-bar ${item.task.status === 'done' ? 'done' : ''}`}
                    style={{
                      left: `calc(${(startIndex / days.length) * 100}% + 2px)`,
                      width: `calc(${(span / days.length) * 100}% - 4px)`,
                      ['--space-color' as string]: item.task.spaceColor ?? 'var(--accent)',
                    }}
                    onClick={() => openTask(item.task.id)}
                    title={`${item.task.title} · ${item.start} → ${item.end}`}
                  >
                    {span >= 3 ? item.task.title : ''}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
