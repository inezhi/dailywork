import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle, ChevronDown, ChevronRight, Timer } from 'lucide-react'
import type { Settings, Task, TodayResult } from '@daily/contracts'
import { useOp, useOpMutation } from '@/lib/query'
import { useTimer } from '@/stores/timer'
import { FocusRing } from '@/components/FocusRing'
import { TaskRow } from '@/components/TaskRow'
import { QuickAdd } from '@/components/QuickAdd'
import { Modal, ModalHeader } from '@/components/Modal'
import {
  fullDateLabel,
  greeting,
  STATUS_LABEL,
  STATUS_ORDER,
  todayIso,
} from '@/lib/format'

export function TodayPage() {
  const today = todayIso()
  const { data, isLoading } = useOp<TodayResult>('today.get', {}, { staleTime: 15_000, refetchInterval: 60_000 })
  const { data: settings } = useOp<Settings>('settings.get')
  const timer = useTimer()
  const navigate = useNavigate()
  const [capacityOpen, setCapacityOpen] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [capacity, setCapacity] = useState('')

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
            {openTasks.length === 0
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
