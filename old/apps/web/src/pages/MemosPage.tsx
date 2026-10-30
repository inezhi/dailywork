import { useRef, useState } from 'react'
import { ArrowRight, Copy, FileText, Paperclip, Pin, PinOff, Plus, Sparkles, Trash2, X } from 'lucide-react'
import type { ListResult, Memo, MemoStats, Task } from '@daily/contracts'
import { useOp, useOpMutation } from '@/lib/query'
import { useQueryClient } from '@tanstack/react-query'
import type { Attachment } from '@daily/contracts'
import { callOp } from '@/lib/api'
import { uploadOwnerFile } from '@/lib/upload'
import { relativeTime } from '@/lib/format'
import { useUi } from '@/stores/ui'
import { toast } from '@/stores/toast'
import { ConfirmDialog } from '@/components/Modal'
import { EmptyState } from '@/components/EmptyState'

export function MemosPage() {
  const { data: stats } = useOp<MemoStats>('memo.stats', {})
  const [tag, setTag] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Memo | null>(null)
  const { data } = useOp<ListResult<Memo>>('memo.list', { tag: tag ?? undefined, limit: 200 })
  const openTask = useUi((s) => s.openTask)

  const create = useOpMutation<{ content: string; tags?: string[] }, Memo>('memo.create', {
    onSuccess: () => {
      setContent('')
      setBusy(false)
    },
    onError: () => setBusy(false),
  })
  const update = useOpMutation<{ id: string; pinned?: boolean; tags?: string[] }, Memo>('memo.update', {
    silent: true,
  })
  const remove = useOpMutation<{ id: string; confirm: boolean }, { id: string }>('memo.delete', {
    onSuccess: () => {
      toast.success('速记已删除')
      setDeleteTarget(null)
    },
  })
  const toTask = useOpMutation<{ id: string }, { memo: Memo; task: Task }>('memo.toTask', {
    onSuccess: ({ task }) => {
      toast.success('已转为任务')
      openTask(task.id)
    },
  })

  const submit = () => {
    if (!content.trim() || busy) return
    setBusy(true)
    create.mutate({ content: content.trim() })
  }

  const memos = data?.items ?? []

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>速记</h1>
          <p className="page-sub">
            捕获想法，不打断手上的事。用 #标签 归类，之后一键转成任务。
          </p>
        </div>
        <div className="head-right">
          <span className="chip soft">共 {stats?.total ?? 0} 条</span>
          <span className="chip soft">今天 {stats?.today ?? 0} 条</span>
          <span className="chip soft">连续 {stats?.streakDays ?? 0} 天</span>
        </div>
      </div>

      <section className="memo-composer">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
          placeholder="记下此刻的想法… 用 #标签 组织，⌘↵ 保存"
          autoFocus
        />
        <div className="memo-composer-foot">
          <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>
            {content.length > 0 ? `${content.length} 字` : '不分类也可以，先写下最要紧的一句。'}
          </span>
          <button className="btn primary sm" style={{ marginLeft: 'auto' }} onClick={submit} disabled={!content.trim() || busy}>
            <Plus size={12} /> {busy ? '保存中…' : '记下来'}
          </button>
        </div>
      </section>

      {(stats?.tags.length ?? 0) > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <button className={`chip ${tag === null ? 'project' : 'tag'}`} style={{ ['--chip-color' as string]: 'var(--accent)' }} onClick={() => setTag(null)}>
            全部
          </button>
          {stats?.tags.slice(0, 14).map((item) => (
            <button
              key={item.tag}
              className={`chip ${tag === item.tag ? 'project' : 'tag'}`}
              style={{ ['--chip-color' as string]: 'var(--accent)' }}
              onClick={() => setTag(tag === item.tag ? null : item.tag)}
            >
              #{item.tag} <span style={{ opacity: 0.6 }}>{item.count}</span>
            </button>
          ))}
        </div>
      )}

      {memos.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Sparkles size={18} />}
            title={tag ? `#${tag} 下还没有速记` : '还没有速记'}
            description="把脑子里的碎片倒在这里。无压记录，之后再整理。"
          />
        </div>
      ) : (
        <div className="memo-grid">
          {memos.map((memo) => (
            <MemoCard
              key={memo.id}
              memo={memo}
              onTag={setTag}
              onPin={() => update.mutate({ id: memo.id, pinned: !memo.pinned })}
              onConvert={() => toTask.mutate({ id: memo.id })}
              onDelete={() => setDeleteTarget(memo)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="删除这条速记？"
        description="删除后无法从界面恢复。"
        busy={remove.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate({ id: deleteTarget.id, confirm: true })}
      />
    </div>
  )
}

function renderContent(content: string) {
  const parts = content.split(/(#[\p{L}\p{N}_-]{1,40})/gu)
  return parts.map((part, index) =>
    part.startsWith('#') ? (
      <span className="hashtag" key={index}>
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    ),
  )
}


function MemoCard({
  memo,
  onTag,
  onPin,
  onConvert,
  onDelete,
}: {
  memo: Memo
  onTag: (tag: string) => void
  onPin: () => void
  onConvert: () => void
  onDelete: () => void
}) {
  const [attachmentsOpen, setAttachmentsOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { data: attachments } = useOp<Attachment[]>(
    'attachment.list',
    { ownerType: 'memo', ownerId: memo.id },
    { enabled: attachmentsOpen },
  )

  const upload = async (files: FileList) => {
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        await uploadOwnerFile('memo', memo.id, file)
      }
      toast.success('附件已添加')
      void queryClient.invalidateQueries({ queryKey: ['attachment.list'] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await callOp('attachment.delete', { id, confirm: true })
      void queryClient.invalidateQueries({ queryKey: ['attachment.list'] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    }
  }

  return (
    <article className="memo-card">
      {memo.pinned && (
        <span style={{ position: 'absolute', top: 10, right: 10, color: 'var(--accent-strong)' }} title="已置顶">
          <Pin size={12} />
        </span>
      )}
      <div className="memo-content">{renderContent(memo.content)}</div>
      <div className="memo-tags">
        {memo.tags.map((tag) => (
          <button key={tag} className="chip tag" onClick={() => onTag(tag)}>
            #{tag}
          </button>
        ))}
      </div>
      {attachmentsOpen && (
        <div className="memo-attachments">
          <input
            ref={fileRef}
            type="file"
            hidden
            multiple
            accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
            onChange={(event) => {
              if (event.target.files?.length) void upload(event.target.files)
              event.target.value = ''
            }}
          />
          {(attachments ?? []).map((file) => (
            <div className="attach-thumb" key={file.id}>
              {file.mime === 'application/pdf' ? (
                <a href={file.url} target="_blank" rel="noreferrer" style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--ink-3)' }}>
                  <FileText size={18} />
                </a>
              ) : (
                <a href={file.url} target="_blank" rel="noreferrer">
                  <img src={file.thumbUrl ?? file.url} alt={file.filename} />
                </a>
              )}
              <button onClick={() => void remove(file.id)} aria-label="删除附件">
                <X size={9} />
              </button>
            </div>
          ))}
          <button className="attach-drop" style={{ padding: '6px 8px', fontSize: 9.5 }} onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Paperclip size={11} /> {uploading ? '上传中…' : '添加'}
          </button>
        </div>
      )}
      <div className="memo-foot">
        <span>{relativeTime(memo.createdAt)}</span>
        {memo.convertedTaskId && <span className="chip soft">已转任务</span>}
        <div className="actions">
          <button className="memo-action" title="附件" onClick={() => setAttachmentsOpen((v) => !v)}>
            <Paperclip size={12} />
          </button>
          <button className="memo-action" title={memo.pinned ? '取消置顶' : '置顶'} onClick={onPin}>
            {memo.pinned ? <PinOff size={12} /> : <Pin size={12} />}
          </button>
          {!memo.convertedTaskId && (
            <button className="memo-action" title="转为任务" onClick={onConvert}>
              <ArrowRight size={12} />
            </button>
          )}
          <button
            className="memo-action"
            title="复制"
            onClick={() => {
              void navigator.clipboard?.writeText(memo.content)
              toast.info('已复制')
            }}
          >
            <Copy size={12} />
          </button>
          <button className="memo-action" title="删除" onClick={onDelete}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </article>
  )
}
