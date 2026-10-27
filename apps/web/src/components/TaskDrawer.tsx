import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  CalendarDays,
  Clock,
  FileText,
  Flag,
  Folder,
  ListChecks,
  Paperclip,
  Play,
  Plus,
  Sparkles,
  Tags,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import type {
  Attachment,
  ListResult,
  Project,
  Settings,
  Tag,
  Task,
  UpdateTaskInput,
} from '@daily/contracts'
import { useOp, useOpMutation } from '@/lib/query'
import { callOp } from '@/lib/api'
import { uploadOwnerFile } from '@/lib/upload'
import { useUi } from '@/stores/ui'
import { useTimer } from '@/stores/timer'
import { toast } from '@/stores/toast'
import { useQueryClient } from '@tanstack/react-query'
import {
  formatDuration,
  PRIORITY_LABEL,
  relativeTime,
  STATUS_LABEL,
  STATUS_ORDER,
} from '@/lib/format'
import { StatusButton } from './StatusButton'
import { PriorityFlag } from './Chips'
import { ConfirmDialog } from './Modal'

interface ActivityEntry {
  opId: string
  command: string
  summary: string
  ts: string
  actor: string
  source: string
}

export function TaskDrawer() {
  const taskId = useUi((s) => s.drawerTaskId)
  if (!taskId) return null
  return <DrawerContent taskId={taskId} />
}

function DrawerContent({ taskId }: { taskId: string }) {
  const closeDrawer = useUi((s) => s.closeDrawer)
  const tab = useUi((s) => s.drawerTab)
  const setTab = useUi((s) => s.setDrawerTab)
  const openAi = useUi((s) => s.openAi)
  const openTask = useUi((s) => s.openTask)
  const navigate = useNavigate()
  const timer = useTimer()
  const queryClient = useQueryClient()

  const { data: task, isLoading } = useOp<Task>('task.get', { id: taskId })
  const { data: projects } = useOp<Project[]>('project.list', {})
  const { data: allTags } = useOp<Tag[]>('tag.list')
  const { data: settings } = useOp<Settings>('settings.get')
  const { data: subtasks } = useOp<ListResult<Task>>('task.list', { parentId: taskId, limit: 100 })
  const { data: activity } = useOp<ActivityEntry[]>('task.activity', { id: taskId, limit: 40 })
  const { data: attachments } = useOp<Attachment[]>('attachment.list', { ownerType: 'task', ownerId: taskId })

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [subtaskInput, setSubtaskInput] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const update = useOpMutation<UpdateTaskInput, Task>('task.update', {
    silent: true,
    onSuccess: () => setSavedAt(Date.now()),
  })
  const remove = useOpMutation<{ id: string; confirm: boolean }, { id: string }>('task.delete', {
    onSuccess: () => {
      toast.success('任务已删除')
      closeDrawer()
    },
  })
  const createSubtask = useOpMutation<{ title: string; parentId: string }, Task>('task.create', {
    onSuccess: () => setSubtaskInput(''),
  })

  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setNotes(task.notes)
  }, [task?.id])

  useEffect(() => {
    if (!task) return
    if (title.trim() === task.title || !title.trim()) return
    const handle = setTimeout(() => {
      update.mutate({ id: task.id, title: title.trim() })
    }, 550)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, task?.id, task?.title])

  useEffect(() => {
    if (!task) return
    if (notes === task.notes) return
    const handle = setTimeout(() => {
      update.mutate({ id: task.id, notes })
    }, 750)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, task?.id, task?.notes])

  const patch = (fields: Partial<UpdateTaskInput>) => {
    if (!task) return
    update.mutate({ id: task.id, ...fields })
  }

  const completedSubtasks = useMemo(
    () => (subtasks?.items ?? []).filter((t) => t.status === 'done').length,
    [subtasks],
  )

  const addTag = async () => {
    if (!task) return
    const name = tagInput.trim().replace(/^#/, '')
    if (!name) return
    try {
      let tag = allTags?.find((t) => t.name.toLowerCase() === name.toLowerCase())
      if (!tag) tag = await callOp<Tag>('tag.create', { name })
      const existing = task.tags.map((t) => t.id)
      if (!existing.includes(tag.id)) {
        patch({ tagIds: [...existing, tag.id] })
      }
      setTagInput('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '无法添加标签')
    }
  }

  const removeTag = (tagId: string) => {
    if (!task) return
    patch({ tagIds: task.tags.filter((t) => t.id !== tagId).map((t) => t.id) })
  }

  const uploadFiles = async (files: FileList | File[]) => {
    if (!task) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        await uploadOwnerFile('task', task.id, file)
      }
      toast.success('附件已添加')
      void queryClient.invalidateQueries({ queryKey: ['attachment.list'] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const removeAttachment = async (id: string) => {
    try {
      await callOp('attachment.delete', { id, confirm: true })
      toast.success('附件已删除')
      void queryClient.invalidateQueries({ queryKey: ['attachment.list'] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    }
  }

  const startFocus = async () => {
    if (!task) return
    const minutes =
      task.estimateMinutes && task.estimateMinutes > 0 && task.estimateMinutes <= 90
        ? task.estimateMinutes
        : settings?.general.defaultFocusMinutes ?? 25
    try {
      await timer.start(minutes, task.id)
      closeDrawer()
      void navigate({ to: '/focus' })
    } catch {
      // timer store surfaces the error
    }
  }

  if (isLoading || !task) {
    return (
      <>
        <div className="scrim" onClick={closeDrawer} />
        <aside className="drawer">
          <div className="drawer-tabs">
            <span style={{ height: 14 }} />
            <button className="drawer-close" onClick={closeDrawer} aria-label="关闭">
              <X size={16} />
            </button>
          </div>
          <div className="drawer-body">
            <div className="skeleton" style={{ height: 26, width: '72%', marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 14, width: '45%' }} />
          </div>
        </aside>
      </>
    )
  }

  return (
    <>
      <div className="scrim" onClick={closeDrawer} />
      <aside className="drawer" aria-label="任务详情">
        <div className="drawer-tabs">
          <button className={tab === 'detail' ? 'active' : ''} onClick={() => setTab('detail')}>
            详情
          </button>
          <button className={tab === 'subtasks' ? 'active' : ''} onClick={() => setTab('subtasks')}>
            子任务 {task.subtaskTotal ? <b style={{ marginLeft: 3, color: 'var(--ink-3)' }}>{task.subtaskDone}/{task.subtaskTotal}</b> : null}
          </button>
          <button className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>
            记录
          </button>
          <button className="drawer-close" onClick={closeDrawer} aria-label="关闭">
            <X size={16} />
          </button>
        </div>

        <div className="drawer-body">
          {tab === 'detail' && (
            <>
              <div className="drawer-title-wrap">
                <StatusButton status={task.status} size={19} onClick={() => patch({ status: task.status === 'done' ? 'next' : 'done' })} />
                <textarea
                  className="drawer-title"
                  rows={2}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onBlur={() => {
                    if (title.trim() && title.trim() !== task.title) update.mutate({ id: task.id, title: title.trim() })
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                {STATUS_ORDER.filter((s) => s !== 'inbox').map((status) => (
                  <button
                    key={status}
                    className="chip"
                    style={{
                      background: task.status === status ? 'var(--accent-soft)' : 'var(--sunken)',
                      color: task.status === status ? 'var(--accent-strong)' : 'var(--ink-2)',
                      fontWeight: task.status === status ? 600 : 500,
                      border: '1px solid',
                      borderColor: task.status === status ? 'var(--accent)' : 'transparent',
                    }}
                    onClick={() => patch({ status })}
                  >
                    {STATUS_LABEL[status]}
                  </button>
                ))}
              </div>

              <div className="drawer-fields">
                <div className="drawer-field">
                  <span className="label">
                    <Folder size={13} /> 项目
                  </span>
                  <span className="value">
                    <select
                      className="mini-input"
                      style={{ width: '100%' }}
                      value={task.projectId ?? ''}
                      onChange={(event) => patch({ projectId: event.target.value || null })}
                    >
                      <option value="">无项目</option>
                      {(projects ?? []).map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </span>
                </div>
                <div className="drawer-field">
                  <span className="label">
                    <CalendarDays size={13} /> 计划
                  </span>
                  <span className="value" style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="date"
                      className="mini-input"
                      value={task.scheduledDate ?? ''}
                      onChange={(event) => patch({ scheduledDate: event.target.value || null })}
                    />
                    <input
                      type="time"
                      className="mini-input"
                      value={task.scheduledTime ?? ''}
                      onChange={(event) => patch({ scheduledTime: event.target.value || null })}
                    />
                  </span>
                </div>
                <div className="drawer-field">
                  <span className="label">
                    <Flag size={13} /> 截止
                  </span>
                  <span className="value">
                    <input
                      type="date"
                      className="mini-input"
                      value={task.dueDate ?? ''}
                      onChange={(event) => patch({ dueDate: event.target.value || null })}
                    />
                  </span>
                </div>
                <div className="drawer-field">
                  <span className="label">
                    <Clock size={13} /> 预估
                  </span>
                  <span className="value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      min={0}
                      step={5}
                      className="mini-input"
                      style={{ width: 70 }}
                      value={task.estimateMinutes ?? ''}
                      onChange={(event) =>
                        patch({ estimateMinutes: event.target.value ? Number(event.target.value) : null })
                      }
                    />
                    <span style={{ color: 'var(--ink-3)', fontSize: 10 }}>分钟</span>
                    {[15, 25, 45, 60].map((m) => (
                      <button
                        key={m}
                        className="chip soft"
                        style={{ cursor: 'pointer' }}
                        onClick={() => patch({ estimateMinutes: m })}
                      >
                        {m}
                      </button>
                    ))}
                  </span>
                </div>
                <div className="drawer-field">
                  <span className="label">
                    <Flag size={13} /> 优先级
                  </span>
                  <span className="value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <PriorityFlag priority={task.priority} size={12} />
                    <select
                      className="mini-input"
                      value={task.priority}
                      onChange={(event) =>
                        patch({ priority: event.target.value as Task['priority'] })
                      }
                    >
                      {(['none', 'low', 'medium', 'high', 'urgent'] as const).map((p) => (
                        <option key={p} value={p}>
                          {PRIORITY_LABEL[p]}
                        </option>
                      ))}
                    </select>
                    {task.actualMinutes != null && (
                      <span style={{ marginLeft: 'auto', color: 'var(--ink-3)', fontSize: 10 }}>
                        实际 {formatDuration(task.actualMinutes)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="drawer-field" style={{ alignItems: 'flex-start' }}>
                  <span className="label" style={{ paddingTop: 6 }}>
                    <Tags size={13} /> 标签
                  </span>
                  <span className="value">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                      {task.tags.map((tag) => (
                        <span key={tag.id} className="chip tag">
                          <span style={{ color: tag.color }}>#</span>
                          {tag.name}
                          <button
                            onClick={() => removeTag(tag.id)}
                            style={{ border: 'none', background: 'transparent', padding: 0, display: 'flex', color: 'var(--ink-3)' }}
                            aria-label={`移除标签 ${tag.name}`}
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                      <input
                        className="mini-input"
                        style={{ width: 90 }}
                        placeholder="+ 标签"
                        value={tagInput}
                        onChange={(event) => setTagInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void addTag()
                          }
                        }}
                      />
                    </div>
                  </span>
                </div>
              </div>

              <div className="drawer-section">
                <div className="drawer-section-head">
                  <span>
                    附件 {attachments && attachments.length > 0 ? `· ${attachments.length}` : ''}
                  </span>
                  <button className="attach-drop" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    <Upload size={11} /> {uploading ? '上传中…' : '添加图片或 PDF'}
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  multiple
                  accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                  onChange={(event) => {
                    if (event.target.files?.length) void uploadFiles(event.target.files)
                    event.target.value = ''
                  }}
                />
                {(attachments ?? []).length > 0 ? (
                  <div
                    className="attach-tray"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      if (event.dataTransfer.files.length) void uploadFiles(event.dataTransfer.files)
                    }}
                  >
                    {(attachments ?? []).map((file) => (
                      <div className="attach-thumb" key={file.id}>
                        {file.mime === 'application/pdf' ? (
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--ink-3)' }}
                            title={file.filename}
                          >
                            <FileText size={22} />
                          </a>
                        ) : (
                          <a href={file.url} target="_blank" rel="noreferrer" title={file.filename}>
                            <img src={file.thumbUrl ?? file.url} alt={file.filename} />
                          </a>
                        )}
                        <button onClick={() => void removeAttachment(file.id)} aria-label="删除附件">
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      border: '1px dashed var(--line)',
                      borderRadius: 7,
                      padding: '12px 10px',
                      textAlign: 'center',
                      fontSize: 10.5,
                      color: 'var(--ink-3)',
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      if (event.dataTransfer.files.length) void uploadFiles(event.dataTransfer.files)
                    }}
                  >
                    <Paperclip size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
                    拖入图片或 PDF，最大 20MB
                  </div>
                )}
              </div>

              <div className="drawer-section">
                <div className="drawer-section-head">
                  <span>备注</span>
                  <span style={{ fontWeight: 400 }}>
                    {savedAt && Date.now() - savedAt < 4000 ? '已保存' : ''}
                  </span>
                </div>
                <textarea
                  className="drawer-notes"
                  placeholder="写下背景、验收标准或下一步…"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>

              <div className="drawer-section">
                <div className="drawer-section-head">
                  <span>子任务 {task.subtaskTotal ? `· ${completedSubtasks}/${task.subtaskTotal}` : ''}</span>
                  <button
                    className="icon-btn ghost"
                    style={{ width: 24, height: 24 }}
                    onClick={() => setTab('subtasks')}
                    title="管理子任务"
                  >
                    <ListChecks size={13} />
                  </button>
                </div>
                <div className="subtask-list">
                  {(subtasks?.items ?? []).slice(0, 4).map((sub) => (
                    <div className="subtask-row" key={sub.id}>
                      <StatusButton
                        status={sub.status}
                        size={14}
                        onClick={() => {
                          if (sub.status === 'done') callOp('task.reopen', { id: sub.id })
                          else callOp('task.complete', { id: sub.id })
                        }}
                      />
                      <span className={`t ${sub.status === 'done' ? 'done' : ''}`} onClick={() => openTask(sub.id)} style={{ cursor: 'pointer' }}>
                        {sub.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="drawer-section" style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn"
                  onClick={() =>
                    openAi({
                      context: { kind: 'task', id: task.id },
                      draft: `帮我拆解「${task.title}」：给我 3 个具体的下一步，并指出最该先做的一件。`,
                    })
                  }
                  title="让 AI 拆解这个任务"
                >
                  <Sparkles size={13} /> AI
                </button>
                <button className="btn primary" style={{ flex: 1 }} onClick={() => void startFocus()}>
                  <Play size={13} /> 开始专注
                </button>
                <button className="btn danger" onClick={() => setConfirmDelete(true)} aria-label="删除任务">
                  <Trash2 size={13} />
                </button>
              </div>
            </>
          )}

          {tab === 'subtasks' && (
            <>
              <h2 style={{ fontSize: 16, margin: '2px 0 12px' }}>{task.title}</h2>
              <div className="subtask-list">
                {(subtasks?.items ?? []).map((sub) => (
                  <div className="subtask-row" key={sub.id} style={{ padding: '7px 0' }}>
                    <StatusButton
                      status={sub.status}
                      size={15}
                      onClick={() => {
                        if (sub.status === 'done') callOp('task.reopen', { id: sub.id })
                        else callOp('task.complete', { id: sub.id })
                      }}
                    />
                    <span className={`t ${sub.status === 'done' ? 'done' : ''}`} style={{ cursor: 'pointer' }} onClick={() => openTask(sub.id)}>
                      {sub.title}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                      {formatDuration(sub.estimateMinutes)}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                <input
                  className="field"
                  placeholder="添加子任务，按 Enter"
                  value={subtaskInput}
                  onChange={(event) => setSubtaskInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && subtaskInput.trim()) {
                      event.preventDefault()
                      createSubtask.mutate({ title: subtaskInput.trim(), parentId: task.id })
                    }
                  }}
                />
                <button
                  className="btn"
                  onClick={() => {
                    if (subtaskInput.trim()) createSubtask.mutate({ title: subtaskInput.trim(), parentId: task.id })
                  }}
                >
                  <Plus size={13} />
                </button>
              </div>
            </>
          )}

          {tab === 'activity' && (
            <>
              <h2 style={{ fontSize: 16, margin: '2px 0 12px' }}>操作记录</h2>
              <div style={{ borderTop: '1px solid var(--line-soft)' }}>
                {(activity ?? []).map((entry) => (
                  <div key={entry.opId} style={{ padding: '9px 0', borderBottom: '1px solid var(--line-soft)' }}>
                    <div style={{ fontSize: 11.5 }}>{entry.summary || entry.command}</div>
                    <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 3 }}>
                      {relativeTime(entry.ts)} · {entry.actor === 'cli' ? '命令行' : entry.actor === 'ai' ? 'AI' : '界面'} ·{' '}
                      {entry.command}
                    </div>
                  </div>
                ))}
                {(activity ?? []).length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', padding: '12px 0' }}>暂无记录</div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="drawer-foot">
          <span>创建于 {relativeTime(task.createdAt)}</span>
          <span style={{ marginLeft: 'auto' }} className="tnum">
            v{task.version}
          </span>
        </div>
      </aside>

      <ConfirmDialog
        open={confirmDelete}
        title="删除这个任务？"
        description="任务及其子任务会被永久删除。此操作会写入审计日志，但无法从界面恢复。"
        busy={remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate({ id: task.id, confirm: true })}
      />
    </>
  )
}
