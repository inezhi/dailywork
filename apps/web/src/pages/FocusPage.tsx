import { useEffect, useMemo, useState } from 'react'
import { Pause, Play, RotateCcw, Timer, TimerReset, X } from 'lucide-react'
import type { FocusSession, FocusStats, ListResult, Settings, Task } from '@daily/contracts'
import { useOp } from '@/lib/query'
import { useTimer } from '@/stores/timer'
import { FocusRing } from '@/components/FocusRing'
import { formatClock, formatDuration, relativeTime, toDateOnly, todayIso } from '@/lib/format'
import { EmptyState } from '@/components/EmptyState'

export function FocusPage() {
  const timer = useTimer()
  const { data: tasks } = useOp<ListResult<Task>>('task.list', {
    excludeStatus: ['done'],
    limit: 100,
    sort: 'manual',
  })
  const { data: stats } = useOp<FocusStats>('focus.stats', {}, { refetchInterval: 30_000 })
  const { data: settings } = useOp<Settings>('settings.get')
  const { data: weekDays } = useOp<Array<{ date: string; minutes: number }>>('focus.days', { days: 7 })
  const { data: sessions } = useOp<ListResult<FocusSession>>('focus.list', { limit: 12 })
  const [minutes, setMinutes] = useState(25)
  const [taskId, setTaskId] = useState('')

  useEffect(() => {
    if (settings?.general.defaultFocusMinutes) setMinutes(settings.general.defaultFocusMinutes)
  }, [settings?.general.defaultFocusMinutes])

  const available = tasks?.items ?? []
  const active = timer.session
  const today = todayIso()
  const todaySessions = (sessions?.items ?? []).filter(
    (session) => toDateOnly(new Date(session.startedAt)) === today,
  )

  const progress = active && timer.totalSeconds > 0 ? 1 - timer.remainingSeconds / timer.totalSeconds : 0
  const done = timer.remainingSeconds === 0 && active

  const activeTask = useMemo(
    () => available.find((t) => t.id === active?.taskId) ?? null,
    [available, active?.taskId],
  )

  const start = async () => {
    try {
      await timer.start(minutes, taskId || null)
    } catch {
      // handled in store
    }
  }

  if (!active) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1>专注</h1>
            <p className="page-sub">一次只做一件事。结束后会自动记录到任务的实际投入。</p>
          </div>
          <div className="head-right">
            <span className="chip soft">今日 {stats?.todayMinutes ?? 0} 分钟</span>
            <span className="chip soft">连续 {stats?.streakDays ?? 0} 天</span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
            gap: 18,
            alignItems: 'start',
          }}
        >
          <section className="card card-pad" style={{ padding: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <FocusRing size={104} stroke={7} value={0} label={String(minutes)} sublabel="分钟" showHalo />
              <div>
                <h2 style={{ margin: 0, fontSize: 21, letterSpacing: '-0.4px' }}>准备开始一段专注</h2>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                  选一个任务，挑一段长度。把手机放远一点，剩下的交给计时器。
                </p>
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <label style={{ fontSize: 10.5, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>正在做的事</label>
              <select className="field" value={taskId} onChange={(event) => setTaskId(event.target.value)}>
                <option value="">不关联任务</option>
                {available.slice(0, 60).map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 10.5, color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>时长</label>
              <div className="focus-presets" style={{ marginTop: 0 }}>
                {[15, 25, 45, 60].map((m) => (
                  <button key={m} className={minutes === m ? 'on' : ''} onClick={() => setMinutes(m)}>
                    {m} 分钟
                  </button>
                ))}
                <input
                  type="number"
                  className="field"
                  style={{ width: 86, height: 29 }}
                  min={1}
                  max={180}
                  value={minutes}
                  onChange={(event) => setMinutes(Math.max(1, Math.min(180, Number(event.target.value) || 1)))}
                />
              </div>
            </div>

            <button className="btn primary lg" style={{ marginTop: 22, width: '100%' }} onClick={() => void start()} disabled={timer.starting}>
              <Play size={15} /> {timer.starting ? '启动中…' : `开始 ${minutes} 分钟专注`}
            </button>
          </section>

          <div>
            <section className="panel" style={{ marginBottom: 14 }}>
              <div className="panel-head">
                <div>
                  <h3>本周专注</h3>
                  <p>完成后自动累计，不需要手动记录。</p>
                </div>
                <span className="chip soft">{stats?.weekMinutes ?? 0} 分钟</span>
              </div>
              <div style={{ display: 'flex', gap: 22 }}>
                <div>
                  <div className="tnum" style={{ fontSize: 30, fontWeight: 680, letterSpacing: '-1px' }}>
                    {stats?.todayMinutes ?? 0}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>今日分钟</div>
                </div>
                <div>
                  <div className="tnum" style={{ fontSize: 30, fontWeight: 680, letterSpacing: '-1px' }}>
                    {stats?.todaySessions ?? 0}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>今日会话</div>
                </div>
                <div>
                  <div className="tnum" style={{ fontSize: 30, fontWeight: 680, letterSpacing: '-1px' }}>
                    {stats?.streakDays ?? 0}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>连续天数</div>
                </div>
              </div>
              <div style={{ marginTop: 18 }}>
                {(stats?.byTask ?? []).slice(0, 4).map((row) => (
                  <div key={row.taskId ?? 'none'} style={{ marginBottom: 9 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 3 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.title}</span>
                      <span style={{ color: 'var(--ink-3)' }} className="tnum">
                        {row.minutes} 分钟
                      </span>
                    </div>
                    <div className="capacity-track" style={{ height: 4 }}>
                      <i style={{ width: `${Math.min(100, (row.minutes / Math.max(1, stats?.weekMinutes ?? 1)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
                {(stats?.byTask ?? []).length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>本周还没有专注记录。</div>
                )}
              </div>
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h3>最近会话</h3>
                  <p>完成与取消都会记入历史。</p>
                </div>
              </div>
              {(sessions?.items ?? []).slice(0, 5).map((session) => (
                <div key={session.id} className="attention-row">
                  <span className="t">{session.taskTitle ?? '未关联任务'}</span>
                  <span className="r stale">{Math.round(session.actualSeconds / 60)} 分钟</span>
                  <span style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>{relativeTime(session.startedAt)}</span>
                </div>
              ))}
              {(sessions?.items ?? []).length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>还没有会话。</div>
              )}
            </section>
          </div>
        </div>

        <section className="panel" style={{ marginTop: 18 }}>
          <div className="panel-head">
            <div>
              <h3>最近 7 天</h3>
              <p>每天完成的专注分钟，不含取消的会话。</p>
            </div>
            <span className="chip soft">本周 {stats?.weekMinutes ?? 0} 分钟</span>
          </div>
          {(weekDays ?? []).every((day) => day.minutes === 0) ? (
            <div className="empty" style={{ padding: '18px 10px 8px' }}>
              <div className="empty-icon"><Timer size={17} /></div>
              <h3>还没有专注记录</h3>
              <p>开始第一段专注后，这里会慢慢长成你的节奏。</p>
            </div>
          ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 120, paddingTop: 6 }}>
            {(weekDays ?? []).map((day) => {
              const max = Math.max(1, ...(weekDays ?? []).map((d) => d.minutes))
              const isToday = day.date === today
              return (
                <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <span className="tnum" style={{ fontSize: 9, color: 'var(--ink-3)' }}>{day.minutes || ''}</span>
                  <div
                    title={`${day.date}：${day.minutes} 分钟`}
                    style={{
                      width: '100%',
                      maxWidth: 52,
                      height: Math.max(4, (day.minutes / max) * 70),
                      borderRadius: '4px 4px 0 0',
                      background: isToday ? 'var(--accent)' : 'color-mix(in oklab, var(--accent) 35%, var(--sunken))',
                    }}
                  />
                  <span style={{ fontSize: 9, color: isToday ? 'var(--accent-strong)' : 'var(--ink-3)', fontWeight: isToday ? 650 : 400 }}>
                    {day.date.slice(5).replace('-', '/')}
                  </span>
                </div>
              )
            })}
          </div>
          )}
        </section>
      </div>
    )
  }

  const task = activeTask ?? (active.taskId ? null : null)

  return (
    <div className="focus-mode" style={{ minHeight: '100%' }}>
      <div className="focus-stage">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            color: 'var(--ink-3)',
            letterSpacing: 0.4,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
          {done ? '这一段完成了' : '专注进行中'}
        </div>
        <div style={{ marginTop: 20 }}>
          <FocusRing
            size={240}
            stroke={9}
            value={progress}
            showHalo
            label={<span>{formatClock(timer.remainingSeconds)}</span>}
            sublabel={done ? '可以结束了' : `共 ${active.plannedMinutes} 分钟`}
          />
        </div>
        <div className="focus-task">{task?.title ?? active.taskTitle ?? '不关联任务'}</div>
        <div className="focus-actions">
          {done ? (
            <button className="btn primary lg" onClick={() => void timer.finish()}>
              <TimerReset size={15} /> 完成并记录
            </button>
          ) : (
            <button className="btn lg" onClick={() => void timer.finish()}>
              <Pause size={15} /> 提前结束
            </button>
          )}
          <button className="btn lg" onClick={() => void timer.cancel()}>
            <X size={15} /> 放弃本次
          </button>
        </div>
        <div style={{ marginTop: 26, fontSize: 11, color: 'var(--ink-3)', display: 'flex', gap: 16 }}>
          <span>开始于 {new Date(active.startedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
          <span>计划 {formatDuration(active.plannedMinutes)}</span>
          <span>今日已完成 {stats?.todayMinutes ?? 0} 分钟</span>
        </div>
      </div>
      <div className="focus-sessions">
        <div className="section-title">
          <span>最近的专注</span>
          <span className="line" />
        </div>
        <div className="list-card">
          {todaySessions.map((session) => (
            <div key={session.id} className="task-row" style={{ cursor: 'default' }}>
              <span className="status-btn done" style={{ width: 15, height: 15 }} />
              <div className="task-main">
                <div className="task-title">{session.taskTitle ?? '未关联任务'}</div>
                <div className="task-sub">{relativeTime(session.startedAt)}</div>
              </div>
              <div className="task-est">{Math.round(session.actualSeconds / 60)} 分钟</div>
            </div>
          ))}
          {todaySessions.length === 0 && (
            <EmptyState icon={<RotateCcw size={18} />} title="今天还没有完成的会话" description="当前这一轮结束后会出现在这里。" />
          )}
        </div>
      </div>
    </div>
  )
}
