import { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Archive, CalendarDays, Check, Pencil, Plus, Target, Trash2 } from 'lucide-react'
import type {
  CreateDeliverableInput,
  CreateTemplateInput,
  Deliverable,
  ListResult,
  Project,
  Task,
  TaskTemplate,
  UpdateProjectInput,
} from '@daily/contracts'
import { useOp, useOpMutation } from '@/lib/query'
import { QuickAdd } from '@/components/QuickAdd'
import { TaskRow } from '@/components/TaskRow'
import { EmptyState } from '@/components/EmptyState'
import { Modal, ModalHeader, ConfirmDialog } from '@/components/Modal'
import { dateBadge, relativeTime, shortDate, STATUS_LABEL, STATUS_ORDER } from '@/lib/format'
import { toast } from '@/stores/toast'

export function ProjectPage() {
  const { projectId } = useParams({ strict: false }) as { projectId: string }
  const navigate = useNavigate()
  const { data: project } = useOp<Project>('project.get', { id: projectId })
  const { data: tasks } = useOp<ListResult<Task>>('task.list', {
    projectId,
    limit: 400,
    sort: 'manual',
  })
  const { data: deliverables } = useOp<Deliverable[]>('deliverable.list', { projectId })
  const { data: activity } = useOp<Array<{ opId: string; command: string; summary: string; ts: string; actor: string }>>('project.activity', { id: projectId, limit: 12 })
  const [editOpen, setEditOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deliverableInput, setDeliverableInput] = useState('')
  const [templateOpen, setTemplateOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const { data: templates } = useOp<TaskTemplate[]>('template.list', {})
  const createTemplate = useOpMutation<CreateTemplateInput, TaskTemplate>('template.create', {
    onSuccess: () => {
      toast.success('模板已保存')
      setTemplateOpen(false)
      setTemplateName('')
    },
  })
  const deleteTemplate = useOpMutation<{ id: string; confirm: boolean }, { id: string }>('template.delete', {
    onSuccess: () => toast.success('模板已删除'),
  })
  const applyTemplate = useOpMutation<{ id: string; projectId: string }, { created: number }>('template.apply', {
    onSuccess: (result) => toast.success(`已从模板创建 ${result.created} 个任务`),
  })

  const createDeliverable = useOpMutation<CreateDeliverableInput, Deliverable>('deliverable.create', {
    onSuccess: () => setDeliverableInput(''),
  })
  const updateDeliverable = useOpMutation<{ id: string; status: 'pending' | 'done' }, Deliverable>(
    'deliverable.update',
    { silent: true },
  )
  const archive = useOpMutation<{ id: string }, Project>('project.archive', {
    onSuccess: () => {
      toast.success('项目已归档')
      void navigate({ to: '/tasks' })
    },
  })
  const remove = useOpMutation<{ id: string; confirm: boolean }, { id: string }>('project.delete', {
    onSuccess: () => {
      toast.success('项目已删除')
      void navigate({ to: '/tasks' })
    },
  })

  if (!project) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 160, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 240 }} />
      </div>
    )
  }

  const items = tasks?.items ?? []
  const done = items.filter((t) => t.status === 'done').length
  const open = items.length - done
  const overdue = items.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10)).length
  const progress = items.length === 0 ? 0 : done / items.length
  const dueBadge = project.dueDate ? dateBadge(project.dueDate) : null

  return (
    <div className="page">
      <section className="project-head">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <span
            style={{
              width: 42,
              height: 42,
              borderRadius: 11,
              background: `color-mix(in oklab, ${project.color} 18%, var(--card))`,
              border: `1px solid color-mix(in oklab, ${project.color} 45%, var(--line))`,
              display: 'grid',
              placeItems: 'center',
              flex: 'none',
            }}
          >
            <span style={{ width: 12, height: 12, borderRadius: 4, background: project.color }} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1>
              {project.name}
              <span className={`chip ${project.status === 'active' ? 'soft' : 'tag'}`}>{project.status === 'active' ? '进行中' : project.status === 'paused' ? '暂停' : project.status === 'done' ? '已完成' : '已归档'}</span>
            </h1>
            <p className="desc">
              {project.description || '还没有描述。写清楚这个项目要交付什么，以及为什么值得做。'}
            </p>
            <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 10.5, color: 'var(--ink-3)', flexWrap: 'wrap' }}>
              <span>{project.spaceName} 空间</span>
              <span>·</span>
              <span>创建于 {relativeTime(project.createdAt)}</span>
              {project.dueDate && (
                <>
                  <span>·</span>
                  <span className={dueBadge?.tone === 'danger' ? 'overdue-text' : ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CalendarDays size={11} /> 截止 {shortDate(project.dueDate)}
                  </span>
                </>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
            <button className="btn" onClick={() => setEditOpen(true)}>
              <Pencil size={13} /> 编辑
            </button>
            <button className="icon-btn" onClick={() => setArchiveOpen(true)} title="归档项目">
              <Archive size={15} />
            </button>
            <button className="icon-btn" onClick={() => setDeleteOpen(true)} title="删除项目">
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        <div className="project-stats">
          <div className="project-stat">
            <b>{items.length}</b>
            <span>任务总数</span>
          </div>
          <div className="project-stat">
            <b>{done}</b>
            <span>已完成</span>
          </div>
          <div className="project-stat">
            <b>{open}</b>
            <span>未完成</span>
          </div>
          <div className="project-stat">
            <b>{Math.round(progress * 100)}%</b>
            <span>进度</span>
          </div>
        </div>
        <div className="progress-line" title={`${done}/${items.length} 已完成`}>
          <i style={{ width: `${progress * 100}%` }} />
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.65fr) minmax(280px, 1fr)', gap: 18, alignItems: 'start' }}>
        <div>
          <QuickAdd defaults={{ projectId }} placeholder="给项目加一个任务…" />
          {STATUS_ORDER.map((status) => {
            const list = items.filter((t) => t.status === status)
            if (list.length === 0) return null
            return (
              <section key={status}>
                <div className="section-title">
                  <span>{STATUS_LABEL[status]}</span>
                  <span className="count">{list.length}</span>
                  <span className="line" />
                </div>
                <div className="list-card">
                  {list.map((task) => (
                    <TaskRow key={task.id} task={task} showProject={false} />
                  ))}
                </div>
              </section>
            )
          })}
          {items.length === 0 && (
            <div className="card" style={{ marginTop: 14 }}>
              <EmptyState
                icon={<Target size={18} />}
                title="项目还没有任务"
                description="从上方添加第一项工作。项目会自动聚合进度、截止和专注时间。"
              />
            </div>
          )}
        </div>

        <div>
          <section className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-head">
              <div>
                <h3>验收标准</h3>
                <p>做到什么程度算完成。</p>
              </div>
            </div>
            <div style={{ fontSize: 11.5, lineHeight: 1.7, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>
              {project.acceptanceCriteria || '还没有写验收标准。编辑项目，把「完成」定义清楚。'}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>任务模板</h3>
                <p>把重复的工作流保存下来，一键展开。</p>
              </div>
            </div>
            {(templates ?? []).length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 10 }}>
                还没有模板。把当前项目的任务保存成模板，下次直接复用。
              </div>
            ) : (
              (templates ?? []).map((template) => (
                <div key={template.id} className="subtask-row">
                  <span style={{ flex: 1, fontSize: 11.5 }}>{template.name}</span>
                  <span style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>{template.items.length} 项</span>
                  <button
                    className="btn sm"
                    onClick={() => applyTemplate.mutate({ id: template.id, projectId })}
                  >
                    应用
                  </button>
                  <button
                    className="icon-btn ghost"
                    style={{ width: 24, height: 24 }}
                    title="删除模板"
                    onClick={() => deleteTemplate.mutate({ id: template.id, confirm: true })}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
            <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setTemplateOpen(true)} disabled={items.length === 0}>
              <Plus size={12} /> 保存当前任务为模板
            </button>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>交付成果</h3>
                <p>可勾选的里程碑与产物。</p>
              </div>
            </div>
            {(deliverables ?? []).map((item) => (
              <div key={item.id} className="subtask-row">
                <button
                  className={`status-btn ${item.status === 'done' ? 'done' : ''}`}
                  style={{ width: 15, height: 15 }}
                  onClick={() => updateDeliverable.mutate({ id: item.id, status: item.status === 'done' ? 'pending' : 'done' })}
                  aria-label="切换交付状态"
                >
                  {item.status === 'done' && <Check size={8} strokeWidth={3} />}
                </button>
                <span className={`t ${item.status === 'done' ? 'done' : ''}`} style={{ fontSize: 11.5 }}>{item.title}</span>
                {item.dueDate && <span style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>{shortDate(item.dueDate)}</span>}
              </div>
            ))}
            {(deliverables ?? []).length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>还没有交付成果。</div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <input
                className="field"
                placeholder="添加交付成果"
                value={deliverableInput}
                onChange={(event) => setDeliverableInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && deliverableInput.trim()) {
                    createDeliverable.mutate({ projectId, title: deliverableInput.trim() })
                  }
                }}
              />
              <button
                className="btn"
                onClick={() => deliverableInput.trim() && createDeliverable.mutate({ projectId, title: deliverableInput.trim() })}
              >
                <Plus size={13} />
              </button>
            </div>
          </section>

          {overdue > 0 && (
            <div className="overdue-banner" style={{ marginTop: 14 }}>
              {overdue} 项任务逾期
            </div>
          )}

          <section className="panel" style={{ marginTop: 14 }}>
            <div className="panel-head">
              <div>
                <h3>最近记录</h3>
                <p>项目与任务的创建、更新、完成与移动。</p>
              </div>
            </div>
            {(activity ?? []).length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>还没有操作记录。</div>
            )}
            {(activity ?? []).map((entry) => (
              <div key={entry.opId} style={{ padding: '7px 0', borderBottom: '1px solid var(--line-soft)' }}>
                <div style={{ fontSize: 11.5 }}>{entry.summary || entry.command}</div>
                <div style={{ fontSize: 9.5, color: 'var(--ink-3)', marginTop: 2 }}>
                  {relativeTime(entry.ts)} · {entry.actor === 'ai' ? 'AI' : entry.actor === 'cli' ? '命令行' : '界面'} · {entry.command}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>

      <EditProjectModal open={editOpen} onClose={() => setEditOpen(false)} project={project} />

      <Modal open={templateOpen} onClose={() => setTemplateOpen(false)} label="保存为任务模板">
        <ModalHeader
          title="保存为任务模板"
          description={`将当前项目的 ${items.length} 个任务保存为可复用模板（标题、预估与优先级）。`}
          onClose={() => setTemplateOpen(false)}
        />
        <div className="modal-body">
          <div className="form-row">
            <label>模板名称</label>
            <input
              className="field"
              autoFocus
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="例如：新版本发布清单"
            />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={() => setTemplateOpen(false)}>取消</button>
          <button
            className="btn primary"
            disabled={!templateName.trim() || createTemplate.isPending}
            onClick={() =>
              createTemplate.mutate({
                name: templateName.trim(),
                projectId,
                items: items.map((task) => ({
                  title: task.title,
                  estimateMinutes: task.estimateMinutes,
                  priority: task.priority,
                })),
              })
            }
          >
            {createTemplate.isPending ? '保存中…' : '保存模板'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={archiveOpen}
        title="归档这个项目？"
        description="项目会从默认列表隐藏，任务和记录都会保留。"
        confirmLabel="归档"
        danger={false}
        busy={archive.isPending}
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => archive.mutate({ id: project.id })}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="删除这个项目？"
        description="项目会被删除，任务会保留但变成未归类。此操作无法从界面恢复。"
        busy={remove.isPending}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate({ id: project.id, confirm: true })}
      />
    </div>
  )
}

function EditProjectModal({ open, onClose, project }: { open: boolean; onClose: () => void; project: Project }) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description)
  const [dueDate, setDueDate] = useState(project.dueDate ?? '')
  const [status, setStatus] = useState(project.status)
  const [criteria, setCriteria] = useState(project.acceptanceCriteria)
  const update = useOpMutation<UpdateProjectInput, Project>('project.update', {
    onSuccess: () => {
      toast.success('项目已更新')
      onClose()
    },
  })
  return (
    <Modal open={open} onClose={onClose} width={540} label="编辑项目">
      <ModalHeader title="编辑项目" onClose={onClose} />
      <div className="modal-body">
        <div className="form-row">
          <label>项目名称</label>
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="form-row">
          <label>描述</label>
          <textarea className="field" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="form-row">
            <label>状态</label>
            <select className="field" value={status} onChange={(event) => setStatus(event.target.value as Project['status'])}>
              <option value="active">进行中</option>
              <option value="paused">暂停</option>
              <option value="done">已完成</option>
              <option value="archived">归档</option>
            </select>
          </div>
          <div className="form-row">
            <label>截止日期</label>
            <input type="date" className="field" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <label>验收标准</label>
          <textarea className="field" rows={3} value={criteria} onChange={(event) => setCriteria(event.target.value)} />
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>
          取消
        </button>
        <button
          className="btn primary"
          disabled={!name.trim() || update.isPending}
          onClick={() =>
            update.mutate({
              id: project.id,
              name: name.trim(),
              description,
              dueDate: dueDate || null,
              status,
              acceptanceCriteria: criteria,
            })
          }
        >
          保存
        </button>
      </div>
    </Modal>
  )
}
