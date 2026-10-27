import { useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertCircle, ArrowUpRight, ChevronDown, ChevronRight, CheckCircle2, Sparkles, Sunset, Timer } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { Routine, Settings, Task, TodayResult } from '@daily/contracts'
import { useOp, useOpMutation } from '@/lib/query'
import { useTimer } from '@/stores/timer'
import { FocusRing } from '@/components/FocusRing'
import { TaskRow } from '@/components/TaskRow'
import { QuickAdd } from '@/components/QuickAdd'
import { Modal, ModalHeader } from '@/components/Modal'
import { callOp } from '@/lib/api'
import { toast } from '@/stores/toast'
import {
  addDays,
  fullDateLabel,
  greeting,
  STATUS_LABEL,
  STATUS_ORDER,
  todayIso,
} from '@/lib/format'

export function TodayPage() {
  const today = todayIso()
  const { data, isLoading } = useOp<TodayResult>(
    'today.get',
    { date: today },
    { staleTime: 15_000, refetchInterval: 60_000 },
  )
  const { data: settings } = useOp<Settings>('settings.get')
  const { data: routines } = useOp<Routine[]>('routine.list', {})
  const timer = useTimer()
  const navigate = useNavigate()
  const [capacityOpen, setCapacityOpen] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [capacity, setCapacity] = useState('')
  const [closeOpen, setCloseOpen] = useState(false)
  const [note, setNote] = useState('')
  const [closing, setClosing] = useState(false)
  const queryClient = useQueryClient()

  const openTasks = useMemo(
    () => (data?.scheduled ?? []).filter((t) => t.status !== 'done'),
    [data],
  )
  const completedToday = data?.completed ?? []
  const scheduledIds = new Set(openTasks.map((t) => t.id))
  const dueOnly = (data?.due ?? []).filter((t) => !scheduledIds.has(t.id))

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const status of STATUS_ORDER) map.set(status, [])
    for (const task of openTasks) map.get(task.status)?.push(task)
    return map
  }, [openTasks])

  const totalPlanned = (data?.plannedMinutes ?? 0) || 0
  const capacityMinutes = data?.capacityMinutes ?? 300
  const completedMinutes = data?.completedMinutes ?? 0
  const totalItems = (data?.scheduled ?? []).length
  const doneItems = (data?.scheduled ?? []).filter((t) => t.status === 'done').length
  const progress = totalItems === 0 ? 0 : doneItems / totalItems
  const capacityRatio = capacityMinutes > 0 ? Math.min(1, totalPlanned / capacityMinutes) : 0
  const doneRatio = totalPlanned > 0 ? Math.min(1, completedMinutes / Math.max(totalPlanned, 1)) : 0

  const updateCapacity = useOpMutation<{ date: string; capacityMinutes: number }, unknown>('capacity.set', {
    onSuccess: () => setCapacityOpen(false),
  })

  const startFocus = async () => {
    if (timer.session) {
      void navigate({ to: '/focus' })
      return
    }
    const next = openTasks.find((t) => t.status === 'doing') ?? openTasks[0]
    try {
      await timer.start(settings?.general.defaultFocusMinutes ?? 25, next?.id)
      void navigate({ to: '/focus' })
    } catch {
      // timer store surfaces the error
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>今天</h1>
          <p className="page-sub">
            {greeting()}，{fullDateLabel(today)}。
            {openTasks.length > 0 ? `还有 ${openTasks.length} 项在等你。` : '安排一件重要的事，就很好。'}
          </p>
        </div>
        <div className="head-right">
          <button
            className="btn"
            onClick={() => {
              setNote(data?.note ?? '')
              setCloseOpen(true)
            }}
          >
            <Sunset size={14} /> 收尾
          </button>
          <button className="btn primary" onClick={() => void startFocus()}>
            <Timer size={14} /> {timer.session ? '回到专注' : '开始专注'}
          </button>
        </div>
      </div>

      <section className="today-hero">
        <FocusRing
          size={104}
          stroke={7}
          value={progress}
          label={`${Math.round(progress * 100)}%`}
          sublabel={`${doneItems}/${totalItems || 0} 项`}
          showHalo
        />
        <div className="today-hero-copy">
          <h2>
            {totalItems === 0 && dueOnly.length === 0
              ? '今天，从一件小事开始'
              : openTasks.length === 0
                ? '今天的安排已经清空'
                : progress >= 0.6
                  ? '节奏很好，继续保持'
                  : '把注意力放在下一件小事上'}
          </h2>
          <p>
            {data?.overdue.length
              ? `有 ${data.overdue.length} 项逾期，先挑一件最小的处理掉。`
              : timer.session
                ? `专注进行中，还剩 ${Math.ceil(timer.remainingSeconds / 60)} 分钟。`
                : '完成的每一小步，都会被记录进本周的复盘。'}
          </p>
          <div className="hero-stats">
            <div className="hero-stat">
              <b className="tnum">{completedToday.length}</b>
              <span>今日完成</span>
            </div>
            <div className="hero-divider" />
            <div className="hero-stat">
              <b className="tnum">{data?.focusMinutes ?? 0}</b>
              <span>专注分钟</span>
            </div>
            <div className="hero-divider" />
            <div className="hero-stat">
              <b className="tnum">{data?.inboxCount ?? 0}</b>
              <span>待整理</span>
            </div>
          </div>
          <div className="capacity">
            <div className="capacity-head">
              <span>
                已安排 {totalPlanned} 分钟 / 容量 {capacityMinutes} 分钟
              </span>
              <button
                onClick={() => {
                  setCapacity(String(capacityMinutes))
                  setCapacityOpen(true)
                }}
                style={{ border: 'none', background: 'transparent', color: 'var(--ink-3)', fontSize: 10.5 }}
              >
                调整容量
              </button>
            </div>
            <div className="capacity-track" title={`已安排 ${totalPlanned} 分钟，已完成 ${completedMinutes} 分钟`}>
              <i className="done" style={{ width: `${capacityRatio * doneRatio * 100}%` }} />
              <i style={{ width: `${Math.max(0, capacityRatio * (1 - doneRatio)) * 100}%` }} />
            </div>
          </div>
        </div>
      </section>

      {data && data.overdue.length > 0 && (
        <div className="overdue-banner">
          <AlertCircle size={15} />
          <span>
            {data.overdue.length} 项已逾期：
            {data.overdue
              .slice(0, 2)
              .map((t) => t.title)
              .join('、')}
            {data.overdue.length > 2 ? '…' : ''}
          </span>
          <button onClick={() => void navigate({ to: '/tasks' })}>去处理</button>
        </div>
      )}

      <QuickAdd defaults={{ scheduledDate: today }} placeholder="给今天加一件事，支持 #标签 与 !2 优先级" />

      {isLoading && (
        <div style={{ marginTop: 18 }}>
          <div className="skeleton" style={{ height: 52, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 52, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 52 }} />
        </div>
      )}

      {!isLoading && openTasks.length === 0 && dueOnly.length === 0 && completedToday.length === 0 && (
        <section className="card first-run">
          <div className="first-run-head">
            <span className="glyph"><Sparkles size={18} /></span>
            <div style={{ flex: 1 }}>
              <h3>上手只要三步</h3>
              <p>先写下今天最想推进的一件事。时序会围绕它安排时间、专注与复盘。</p>
            </div>
            <Link to="/docs" className="first-run-link">
              使用指南 <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="first-run-steps">
            <div className="first-run-step">
              <b>01</b>
              <span>写下来</span>
              <small>在上方输入标题，按 Enter 保存。</small>
            </div>
            <div className="first-run-step">
              <b>02</b>
              <span>给它时间</span>
              <small>点开任务，设置预估与计划日期。</small>
            </div>
            <div className="first-run-step">
              <b>03</b>
              <span>进入专注</span>
              <small>25 分钟后，实际投入会自动记录。</small>
            </div>
          </div>
        </section>
      )}

      {(() => {
        const day = new Date().getDay()
        const todays = (routines ?? []).filter((routine) => routine.enabled && routine.weekdays.includes(day))
        if (todays.length === 0) return null
        return (
          <section>
            <div className="section-title">
              <span>今日例程</span>
              <span className="count">{todays.length}</span>
              <span className="line" />
            </div>
            <div className="list-card">
              {todays.map((routine) => (
                <div key={routine.id} className="task-row" style={{ cursor: 'default', paddingTop: 9, paddingBottom: 9 }}>
                  <span className="icon-pill" style={{ width: 48 }}>
                    {routine.time ?? '—'}
                  </span>
                  <span className="task-main">
                    <span className="task-title" style={{ fontWeight: 500 }}>{routine.name}</span>
                  </span>
                  <span className="chip soft">例程</span>
                </div>
              ))}
            </div>
          </section>
        )
      })()}

      {STATUS_ORDER.filter((s) => s !== 'done' && s !== 'inbox').map((status) => {
        const tasks = grouped.get(status) ?? []
        if (tasks.length === 0) return null
        return (
          <section key={status}>
            <div className="section-title">
              <span>{STATUS_LABEL[status]}</span>
              <span className="count">{tasks.length}</span>
              <span className="line" />
            </div>
            <div className="list-card">
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          </section>
        )
      })}

      {dueOnly.length > 0 && (
        <section>
          <div className="section-title">
            <span>今天到期</span>
            <span className="count">{dueOnly.length}</span>
            <span className="line" />
          </div>
          <div className="list-card">
            {dueOnly.map((task) => (
              <TaskRow key={task.id} task={task} showDate={false} />
            ))}
          </div>
        </section>
      )}

      {completedToday.length > 0 && (
        <section>
          <div className="section-title">
            <button onClick={() => setShowDone((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {showDone ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>今日已完成</span>
              <span className="count">{completedToday.length}</span>
            </button>
            <span className="line" />
          </div>
          {showDone && (
            <div className="list-card">
              {completedToday.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          )}
        </section>
      )}

      <Modal open={closeOpen} onClose={() => setCloseOpen(false)} width={560} label="今天收尾">
        <ModalHeader
          title="今天收尾"
          description={`${fullDateLabel(today)} · 给今天一个句号，明天会更清楚。`}
          onClose={() => setCloseOpen(false)}
        />
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              ['已完成', completedToday.length, '项'],
              ['未完成', openTasks.length, '项'],
              ['专注', data?.focusMinutes ?? 0, '分钟'],
              ['安排', data?.plannedMinutes ?? 0, '分钟'],
            ].map(([label, value, suffix]) => (
              <div key={String(label)} style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: '9px 11px' }}>
                <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>{label}</div>
                <div className="tnum" style={{ fontSize: 20, fontWeight: 650, marginTop: 2 }}>
                  {value}<span style={{ fontSize: 9.5, color: 'var(--ink-3)', marginLeft: 2 }}>{suffix}</span>
                </div>
              </div>
            ))}
          </div>

          {completedToday.length > 0 && (
            <>
              <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 6 }}>今天完成的</div>
              <div style={{ maxHeight: 120, overflowY: 'auto', marginBottom: 14 }}>
                {completedToday.map((task) => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, padding: '3px 0' }}>
                    <CheckCircle2 size={12} color="var(--success)" />
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {openTasks.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--ink-3)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 7, padding: '9px 11px', marginBottom: 14 }}>
              还有 {openTasks.length} 项已安排但未完成。可以把它们挪到明天，明天重新决定优先级。
            </div>
          )}

          <div className="form-row">
            <label>给今天留一句话（可选）</label>
            <textarea
              className="field"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="今天的节奏如何？明天最想先做什么？"
            />
          </div>
        </div>
        <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
          <button
            className="btn"
            disabled={closing}
            onClick={async () => {
              try {
                await callOp('capacity.set', { date: today, capacityMinutes: data?.capacityMinutes ?? 300, note })
                toast.success('这句话已记下')
                void queryClient.invalidateQueries()
              } catch (error) {
                toast.error(error instanceof Error ? error.message : '保存失败')
              }
            }}
          >
            只保存这句话
          </button>
          <button
            className="btn primary"
            disabled={closing}
            onClick={async () => {
              setClosing(true)
              try {
                await callOp('capacity.set', { date: today, capacityMinutes: data?.capacityMinutes ?? 300, note })
                if (openTasks.length > 0) {
                  await Promise.all(
                    openTasks.map((task) =>
                      callOp('task.update', { id: task.id, scheduledDate: addDays(today, 1) }),
                    ),
                  )
                }
                toast.success(openTasks.length > 0 ? '已收尾，未完成项移到明天' : '今天收尾完成')
                void queryClient.invalidateQueries()
                setCloseOpen(false)
              } catch (error) {
                toast.error(error instanceof Error ? error.message : '收尾失败')
              } finally {
                setClosing(false)
              }
            }}
          >
            {closing ? '收尾中…' : openTasks.length > 0 ? `移到明天并收尾（${openTasks.length}）` : '完成收尾'}
          </button>
        </div>
      </Modal>

      <Modal open={capacityOpen} onClose={() => setCapacityOpen(false)} label="调整今日容量">
        <ModalHeader
          title="今天的容量"
          description="按自己真实的可用时间安排，而不是理想状态。"
          onClose={() => setCapacityOpen(false)}
        />
        <div className="modal-body">
          <div className="form-row">
            <label>可用分钟数</label>
            <input
              className="field"
              type="number"
              min={0}
              step={15}
              value={capacity}
              autoFocus
              onChange={(event) => setCapacity(event.target.value)}
            />
          </div>
          <div className="swatches">
            {[120, 180, 240, 300, 360, 480].map((m) => (
              <button key={m} className="chip soft" onClick={() => setCapacity(String(m))} style={{ cursor: 'pointer' }}>
                {m} 分钟
              </button>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={() => setCapacityOpen(false)}>
            取消
          </button>
          <button
            className="btn primary"
            disabled={updateCapacity.isPending}
            onClick={() => updateCapacity.mutate({ date: today, capacityMinutes: Number(capacity) || 0 })}
          >
            保存
          </button>
        </div>
      </Modal>
    </div>
  )
}
