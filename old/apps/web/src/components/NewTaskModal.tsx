import { useEffect, useRef, useState } from 'react'
import type { CreateTaskInput, Project, Task } from '@daily/contracts'
import { useOp, useOpMutation } from '@/lib/query'
import { Modal, ModalHeader } from './Modal'
import { useUi } from '@/stores/ui'
import { toast } from '@/stores/toast'
import { todayIso } from '@/lib/format'

export function NewTaskModal() {
  const open = useUi((s) => s.newTaskOpen)
  const setOpen = useUi((s) => s.setNewTask)
  const openTask = useUi((s) => s.openTask)
  const { data: projects } = useOp<Project[]>('project.list', {}, { enabled: open })
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState('')
  const [scheduledDate, setScheduledDate] = useState(todayIso())
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<CreateTaskInput['priority']>('none')
  const [estimate, setEstimate] = useState('')
  const [notes, setNotes] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => titleRef.current?.focus(), 60)
    } else {
      setTitle('')
      setNotes('')
      setPriority('none')
      setEstimate('')
      setDueDate('')
      setProjectId('')
      setScheduledDate(todayIso())
    }
  }, [open])

  const create = useOpMutation<CreateTaskInput, Task>('task.create', {
    onSuccess: (task) => {
      toast.success('任务已创建')
      setOpen(false)
      setTimeout(() => openTask(task.id), 80)
    },
  })

  const submit = () => {
    if (!title.trim() || create.isPending) return
    create.mutate({
      title: title.trim(),
      notes: notes.trim() || undefined,
      projectId: projectId || null,
      scheduledDate: scheduledDate || null,
      dueDate: dueDate || null,
      priority,
      estimateMinutes: estimate ? Number(estimate) : null,
    })
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)} width={520} label="新建任务">
      <ModalHeader title="新建任务" description="先记下来，细节可以之后再补。" onClose={() => setOpen(false)} />
      <div className="modal-body">
        <div className="form-row">
          <input
            ref={titleRef}
            className="field"
            style={{ height: 40, fontSize: 15, fontWeight: 550 }}
            placeholder="要做什么？"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault()
                submit()
              }
            }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="form-row">
            <label>项目</label>
            <select className="field" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">无项目</option>
              {(projects ?? []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>优先级</label>
            <select
              className="field"
              value={priority}
              onChange={(event) => setPriority(event.target.value as CreateTaskInput['priority'])}
            >
              <option value="none">无优先级</option>
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
              <option value="urgent">紧急</option>
            </select>
          </div>
          <div className="form-row">
            <label>计划日期</label>
            <input
              type="date"
              className="field"
              value={scheduledDate}
              onChange={(event) => setScheduledDate(event.target.value)}
            />
          </div>
          <div className="form-row">
            <label>截止日期</label>
            <input type="date" className="field" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
          <div className="form-row">
            <label>预估（分钟）</label>
            <input
              type="number"
              min={0}
              step={5}
              className="field"
              placeholder="25"
              value={estimate}
              onChange={(event) => setEstimate(event.target.value)}
            />
          </div>
        </div>
        <div className="form-row">
          <label>备注</label>
          <textarea
            className="field"
            rows={3}
            placeholder="补充背景、验收标准或链接…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={() => setOpen(false)}>
          取消
        </button>
        <button className="btn primary" onClick={submit} disabled={!title.trim() || create.isPending}>
          {create.isPending ? '创建中…' : '创建任务'}
        </button>
      </div>
    </Modal>
  )
}
