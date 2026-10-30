import { useState } from 'react'
import { CornerDownLeft, Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { CreateTaskInput, Tag } from '@daily/contracts'
import { parseQuickAdd } from '@/lib/quick-add'
import { callOp } from '@/lib/api'
import { toast } from '@/stores/toast'

export function QuickAdd({
  placeholder = '添加一个任务，按 Enter 保存',
  defaults,
  autoFocus,
  onCreated,
}: {
  placeholder?: string
  defaults?: Partial<CreateTaskInput>
  autoFocus?: boolean
  onCreated?: (taskId: string) => void
}) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const queryClient = useQueryClient()

  const submit = async () => {
    const parsed = parseQuickAdd(value)
    if (!parsed.title || busy) return
    setBusy(true)
    try {
      const tagIds: string[] = []
      for (const name of parsed.tags) {
        const tag = await callOp<Tag>('tag.create', { name })
        tagIds.push(tag.id)
      }
      const task = await callOp<{ id: string }>('task.create', {
        title: parsed.title,
        priority: parsed.priority,
        scheduledDate: parsed.scheduledDate ?? defaults?.scheduledDate,
        projectId: defaults?.projectId ?? null,
        status: defaults?.status,
        spaceId: defaults?.spaceId,
        tagIds: tagIds.length ? tagIds : undefined,
      })
      setValue('')
      queryClient.invalidateQueries()
      onCreated?.(task.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建任务失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="quick-add">
      <Plus size={16} color="var(--ink-3)" />
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault()
            void submit()
          }
          if (event.key === 'Escape') {
            setValue('')
            ;(event.target as HTMLInputElement).blur()
          }
        }}
        placeholder={placeholder}
        aria-label="快速添加任务"
      />
      {value.trim() && (
        <button className="btn primary sm" onClick={() => void submit()} disabled={busy}>
          {busy ? '保存中…' : '添加'}
          <CornerDownLeft size={12} />
        </button>
      )}
    </div>
  )
}
