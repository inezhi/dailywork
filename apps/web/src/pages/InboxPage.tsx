import { useState } from 'react'
import { ArrowRight, Check, Inbox as InboxIcon, Trash2 } from 'lucide-react'
import type { ListResult, Memo, Task } from '@daily/contracts'
import { useOp, useOpMutation } from '@/lib/query'
import { useUi } from '@/stores/ui'
import { toast } from '@/stores/toast'
import { TaskRow } from '@/components/TaskRow'
import { EmptyState } from '@/components/EmptyState'
import { relativeTime, todayIso } from '@/lib/format'

export function InboxPage() {
  const openTask = useUi((s) => s.openTask)
  const [capture, setCapture] = useState('')
  const [kind, setKind] = useState<'memo' | 'task'>('memo')
  const { data: tasks } = useOp<ListResult<Task>>('task.list', {
    status: ['inbox'],
    limit: 100,
    sort: 'created',
  })
  const { data: memos } = useOp<ListResult<Memo>>('memo.list', { limit: 100 })
  const captureMutation = useOpMutation<{ content: string; kind: 'memo' | 'task' }, { kind: string; id: string }>(
    'inbox.capture',
    {
      onSuccess: () => {
        setCapture('')
        toast.success('已收进收件箱')
      },
    },
  )
  const scheduleToday = useOpMutation<Record<string, unknown>, Task>('task.update', {
    silent: true,
    onSuccess: () => toast.success('已安排到今天'),
  })
  const convert = useOpMutation<{ id: string }, { memo: Memo; task: Task }>('memo.toTask', {
    onSuccess: ({ task }) => {
      toast.success('已转为任务')
      openTask(task.id)
    },
  })
  const removeMemo = useOpMutation<{ id: string; confirm: boolean }, { id: string }>('memo.delete', {
    onSuccess: () => toast.success('速记已删除'),
  })
  const removeTask = useOpMutation<{ id: string; confirm: boolean }, { id: string }>('task.delete', {
    onSuccess: () => toast.success('任务已删除'),
  })

  const taskItems = tasks?.items ?? []
  const memoItems = (memos?.items ?? []).filter((m) => !m.convertedTaskId)
  const total = taskItems.length + memoItems.length

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="page-head">
        <div>
          <h1>收件箱</h1>
          <p className="page-sub">
            {total > 0 ? `${total} 项等待整理。决定下一步，或者删掉。` : '清空了。新的想法随时可以丢进来。'}
          </p>
        </div>
        <div className="head-right">
          <span className="chip soft">{taskItems.length} 任务</span>
          <span className="chip soft">{memoItems.length} 速记</span>
        </div>
      </div>

      <section className="memo-composer" style={{ marginBottom: 22 }}>
        <textarea
          value={capture}
          onChange={(event) => setCapture(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && capture.trim()) {
              event.preventDefault()
              captureMutation.mutate({ content: capture.trim(), kind })
            }
          }}
          placeholder="丢进来一个想法、一个待办、一个链接…"
          style={{ minHeight: 48 }}
        />
        <div className="memo-composer-foot">
          <div className="seg">
            <button className={kind === 'memo' ? 'on' : ''} onClick={() => setKind('memo')}>
              速记
            </button>
            <button className={kind === 'task' ? 'on' : ''} onClick={() => setKind('task')}>
              任务
            </button>
          </div>
          <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>⌘↵ 收集</span>
          <button
            className="btn primary sm"
            style={{ marginLeft: 'auto' }}
            disabled={!capture.trim() || captureMutation.isPending}
            onClick={() => captureMutation.mutate({ content: capture.trim(), kind })}
          >
            收集
          </button>
        </div>
      </section>

      {total === 0 && (
        <div className="card">
          <EmptyState
            icon={<InboxIcon size={18} />}
            title="收件箱已清空"
            description="这里只放还没想清楚下一步的东西。整理完就让它去项目、日期或专注里。"
          />
        </div>
      )}

      {taskItems.length > 0 && (
        <section>
          <div className="section-title">
            <span>待整理任务</span>
            <span className="count">{taskItems.length}</span>
            <span className="line" />
          </div>
          <div className="list-card">
            {taskItems.map((task) => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--line-soft)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <TaskRow task={task} compact />
                </div>
                <div style={{ display: 'flex', gap: 2, paddingRight: 10 }}>
                  <button
                    className="icon-btn ghost"
                    title="安排到今天"
                    onClick={() => scheduleToday.mutate({ id: task.id, scheduledDate: todayIso() })}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    className="icon-btn ghost"
                    title="删除"
                    onClick={() => removeTask.mutate({ id: task.id, confirm: true })}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {memoItems.length > 0 && (
        <section>
          <div className="section-title">
            <span>待整理速记</span>
            <span className="count">{memoItems.length}</span>
            <span className="line" />
          </div>
          <div className="list-card">
            {memoItems.map((memo) => (
              <div
                key={memo.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '11px 14px',
                  borderBottom: '1px solid var(--line-soft)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{memo.content}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--ink-3)', marginTop: 4 }}>
                    {relativeTime(memo.createdAt)}
                    {memo.tags.length > 0 ? ` · ${memo.tags.map((t) => `#${t}`).join(' ')}` : ''}
                  </div>
                </div>
                <button className="btn sm" onClick={() => convert.mutate({ id: memo.id })}>
                  <ArrowRight size={12} /> 转任务
                </button>
                <button className="icon-btn ghost" title="删除" onClick={() => removeMemo.mutate({ id: memo.id, confirm: true })}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
