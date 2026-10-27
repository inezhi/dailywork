import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { Image } from '@tiptap/extension-image'
import { Highlight } from '@tiptap/extension-highlight'
import {
  Archive,
  Bold,
  Code,
  FilePlus2,
  FileText,
  Heading1,
  Heading2,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Plus,
  Quote,
  Redo2,
  Search,
  Sparkles,
  Strikethrough,
  Table2,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import type { Document, DocumentDetail, Task } from '@daily/contracts'
import { useOp, useOpMutation } from '@/lib/query'
import { useUi } from '@/stores/ui'
import { uploadOwnerFile } from '@/lib/upload'
import { callOp } from '@/lib/api'
import { toast } from '@/stores/toast'
import { ConfirmDialog } from '@/components/Modal'
import { EmptyState } from '@/components/EmptyState'
import { fullDateLabel, relativeTime } from '@/lib/format'

interface DocNode extends Document {
  children: DocNode[]
}

export function DocsPage() {
  const params = useParams({ strict: false }) as { docId?: string }
  const docId = params.docId
  const navigate = useNavigate()
  const { data: docs, isLoading } = useOp<Document[]>('document.list', {})
  const { data: detail } = useOp<DocumentDetail>(
    'document.get',
    { id: docId ?? '' },
    { enabled: Boolean(docId) },
  )
  const [filter, setFilter] = useState('')
  const [creating, setCreating] = useState(false)

  const tree = useMemo(() => buildTree(docs ?? []), [docs])
  const filtered = useMemo(() => {
    if (!filter.trim()) return tree
    const q = filter.toLowerCase()
    const matches = (node: DocNode): boolean =>
      node.title.toLowerCase().includes(q) || node.excerpt.toLowerCase().includes(q) || node.children.some(matches)
    return tree.filter(matches)
  }, [tree, filter])

  useEffect(() => {
    if (!docId && docs && docs.length > 0) {
      void navigate({ to: '/docs/$docId', params: { docId: docs[0]!.id }, replace: true })
    }
  }, [docId, docs, navigate])

  const createDoc = async () => {
    if (creating) return
    setCreating(true)
    try {
      const doc = await callOp<Document>('document.create', { title: '未命名文档' })
      toast.success('文档已创建')
      await navigate({ to: '/docs/$docId', params: { docId: doc.id } })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="page page-wide" style={{ padding: 0 }}>
      <div className="docs-layout">
        <aside className="docs-tree">
          <div className="doc-tree-head">
            <span>文档</span>
            <button className="icon-btn ghost" style={{ width: 24, height: 24 }} onClick={() => void createDoc()} title="新建文档">
              <Plus size={14} />
            </button>
          </div>
          <div className="top-search" style={{ width: '100%', margin: '0 0 10px', height: 30 }}>
            <Search size={12} />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="筛选文档"
              style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: 11.5 }}
            />
          </div>
          {isLoading && <div className="skeleton" style={{ height: 28 }} />}
          {filtered.map((node) => (
            <DocTreeItem
              key={node.id}
              node={node}
              depth={0}
              activeId={docId}
              onSelect={(id) => void navigate({ to: '/docs/$docId', params: { docId: id } })}
              onCreateChild={async (parentId) => {
                const doc = await callOp<Document>('document.create', {
                  title: '未命名文档',
                  parentId,
                })
                void navigate({ to: '/docs/$docId', params: { docId: doc.id } })
              }}
            />
          ))}
          {!isLoading && (docs?.length ?? 0) === 0 && (
            <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => void createDoc()}>
              <FilePlus2 size={13} /> 新建第一篇文档
            </button>
          )}
        </aside>

        <main className="docs-main" style={{ position: 'relative' }}>
          {creating && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'grid', placeItems: 'center', background: 'color-mix(in oklab, var(--bg) 72%, transparent)', backdropFilter: 'blur(2px)', fontSize: 12, color: 'var(--ink-3)' }}>
              正在创建文档…
            </div>
          )}
          {docId && detail ? (
            <DocEditor key={detail.document.id} detail={detail} />
          ) : (
            <div style={{ padding: 40 }}>
              <div className="card">
                <EmptyState
                  icon={<FileText size={20} />}
                  title={isLoading ? '正在载入文档…' : '写点东西'}
                  description="文档可以挂在空间、项目或任务下，也可以互相链接。用 / 菜单快速插入块。"
                  action={
                    <button className="btn primary" onClick={() => void createDoc()}>
                      <Plus size={14} /> 新建文档
                    </button>
                  }
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function buildTree(flat: Document[]): DocNode[] {
  const map = new Map<string, DocNode>()
  for (const doc of flat) map.set(doc.id, { ...doc, children: [] })
  const roots: DocNode[] = []
  for (const doc of map.values()) {
    if (doc.parentId && map.has(doc.parentId)) map.get(doc.parentId)!.children.push(doc)
    else roots.push(doc)
  }
  const sort = (nodes: DocNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
    for (const node of nodes) sort(node.children)
  }
  sort(roots)
  return roots
}

function DocTreeItem({
  node,
  depth,
  activeId,
  onSelect,
  onCreateChild,
}: {
  node: DocNode
  depth: number
  activeId?: string
  onSelect: (id: string) => void
  onCreateChild: (parentId: string) => void
}) {
  return (
    <>
      <div
        className={`doc-tree-item ${activeId === node.id ? 'active' : ''}`}
        style={{ paddingLeft: 7 + depth * 14 }}
        onClick={() => onSelect(node.id)}
      >
        <FileText size={12} style={{ color: 'var(--ink-3)', flex: 'none' }} />
        <span className="t">{node.title || '未命名文档'}</span>
        <button
          className="icon-btn ghost"
          style={{ width: 18, height: 18, flex: 'none' }}
          onClick={(event) => {
            event.stopPropagation()
            onCreateChild(node.id)
          }}
          title="新建子文档"
        >
          <Plus size={11} />
        </button>
      </div>
      {node.children.map((child) => (
        <DocTreeItem key={child.id} node={child} depth={depth + 1} activeId={activeId} onSelect={onSelect} onCreateChild={onCreateChild} />
      ))}
    </>
  )
}

function DocEditor({ detail }: { detail: DocumentDetail }) {
  const doc = detail.document
  const navigate = useNavigate()
  const [title, setTitle] = useState(doc.title)
  const [status, setStatus] = useState<'saved' | 'saving'>('saved')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [aiMenuOpen, setAiMenuOpen] = useState(false)
  const [aiSelection, setAiSelection] = useState('')
  const [linkedTask, setLinkedTask] = useState<Task | null>(null)
  const loadedRef = useRef<string | null>(null)
  const openAi = useUi((s) => s.openAi)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef(title)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true },
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder: '输入 / 唤起菜单，或直接开始写…' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      Highlight,
    ],
    content: detail.body.content as Record<string, unknown>,
    editorProps: {
      attributes: { class: 'prose-editor' },
    },
    onUpdate: ({ editor: ed }) => {
      setStatus('saving')
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        void persist(ed.getJSON(), ed.getText())
      }, 850)
    },
  })

  const persist = async (content: unknown, text: string) => {
    setStatus('saving')
    try {
      await callOp('document.saveBody', { id: doc.id, content, text })
      if ((titleRef.current === '未命名文档' || !titleRef.current.trim()) && text.trim()) {
        const nextTitle = text.trim().split('\n')[0]!.slice(0, 80)
        titleRef.current = nextTitle
        setTitle(nextTitle)
        await callOp('document.update', { id: doc.id, title: nextTitle })
      }
      setStatus('saved')
    } catch (error) {
      setStatus('saved')
      toast.error(error instanceof Error ? error.message : '保存失败')
    }
  }

  useEffect(() => {
    titleRef.current = title
  }, [title])

  useEffect(() => {
    if (!editor || loadedRef.current === doc.id) return
    editor.commands.setContent(detail.body.content as Record<string, unknown>, { emitUpdate: false })
    loadedRef.current = doc.id
    setTitle(doc.title)
  }, [editor, doc.id, detail.body.content, doc.title])

  useEffect(() => {
    const current = doc.title
    if (!title.trim() || title.trim() === current) return
    if (title === '未命名文档') return
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(() => {
      callOp('document.update', { id: doc.id, title: title.trim() }).catch(() => undefined)
    }, 450)
    return () => {
      if (titleTimer.current) clearTimeout(titleTimer.current)
    }
  }, [title, doc.id, doc.title])

  useEffect(() => {
    if (doc.taskId) {
      callOp<Task>('task.get', { id: doc.taskId }).then(setLinkedTask).catch(() => undefined)
    } else {
      setLinkedTask(null)
    }
  }, [doc.taskId])

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (titleTimer.current) clearTimeout(titleTimer.current)
    }
  }, [])

  const remove = useOpMutation<{ id: string; confirm: boolean }, { id: string }>('document.delete', {
    onSuccess: () => {
      toast.success('文档已删除')
      void navigate({ to: '/docs' })
    },
  })
  const archive = useOpMutation<{ id: string }, Document>('document.archive', {
    onSuccess: () => {
      toast.success('文档已归档')
      void navigate({ to: '/docs' })
    },
  })
  const createChild = async () => {
    const child = await callOp<Document>('document.create', {
      title: '未命名文档',
      parentId: doc.id,
    })
    void navigate({ to: '/docs/$docId', params: { docId: child.id } })
  }

  if (!editor) {
    return <div style={{ padding: 40 }} className="skeleton" />
  }

  return (
    <div className="doc-editor">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <input
          className="doc-title-input"
          value={title}
          placeholder="未命名文档"
          onChange={(event) => setTitle(event.target.value)}
        />
        <div style={{ display: 'flex', gap: 4, flex: 'none', paddingTop: 6 }}>
          <button className="icon-btn ghost" onClick={() => void createChild()} title="新建子文档">
            <FilePlus2 size={15} />
          </button>
          <button className="icon-btn ghost" onClick={() => archive.mutate({ id: doc.id })} title="归档">
            <Archive size={15} />
          </button>
          <button className="icon-btn ghost" onClick={() => setConfirmDelete(true)} title="删除">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <div className="doc-meta">
        <span>{status === 'saving' ? '保存中…' : '已保存'}</span>
        <span>·</span>
        <span>更新于 {relativeTime(doc.updatedAt)}</span>
        {linkedTask && (
          <>
            <span>·</span>
            <span className="chip project">关联任务：{linkedTask.title}</span>
          </>
        )}
      </div>

      <input
        ref={imageRef}
        type="file"
        hidden
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          try {
            const attachment = await uploadOwnerFile('document', doc.id, file)
            editor.chain().focus().setImage({ src: attachment.url }).run()
            toast.success('图片已插入')
          } catch (error) {
            toast.error(error instanceof Error ? error.message : '上传失败')
          }
        }}
      />
      <div className="doc-toolbar-wrap">
        <DocToolbar
          editor={editor}
          onImage={() => imageRef.current?.click()}
          onAi={() => {
            const { from, to } = editor.state.selection
            setAiSelection(from !== to ? editor.state.doc.textBetween(from, to, ' ') : '')
            setAiMenuOpen((value) => !value)
            if (!aiMenuOpen) {
              const selected = from !== to ? editor.state.doc.textBetween(from, to, ' ') : ''
              setAiSelection(selected)
            }
          }}
        />
        {aiMenuOpen && (
          <div className="ai-doc-menu">
            <div className="hint">
              {aiSelection ? `已选中 ${aiSelection.length} 个字符` : '未选中文字时，AI 会阅读整篇文档'}
            </div>
            {[
              {
                label: '润色选段',
                prompt: aiSelection
                  ? `请润色下面这段文字，保持原意，语气克制，直接给我改写后的版本：\n\n${aiSelection}`
                  : '请润色这篇文档的开头，让表达更克制、更清楚，给出改写版本。',
              },
              {
                label: '继续写下去',
                prompt: aiSelection
                  ? `基于下面这段内容，顺着它的语气继续写 2–3 段，不要重复原文：\n\n${aiSelection}`
                  : '基于这篇文档，继续写 2–3 段，延续它的语气与主题。',
              },
              {
                label: '提取三个要点',
                prompt: aiSelection
                  ? `把下面内容压缩成三个要点，每个一句话：\n\n${aiSelection}`
                  : '把这篇文档压缩成三个要点，每个一句话。',
              },
              {
                label: '翻译成英文',
                prompt: aiSelection
                  ? `把下面这段文字翻译成自然、准确的英文，保留原有语气：\n\n${aiSelection}`
                  : '把这篇文档翻译成自然、准确的英文，保留原有语气。',
              },
              {
                label: '提取可执行任务',
                prompt: aiSelection
                  ? `从下面内容里提取 3–5 个可执行的下一步，用列表给出，并说明建议的先后顺序：\n\n${aiSelection}`
                  : '从这篇文档里提取 3–5 个可执行任务，用列表给出，并说明建议的先后顺序。',
              },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  setAiMenuOpen(false)
                  openAi({ context: { kind: 'document', id: doc.id }, draft: item.prompt })
                }}
              >
                <Sparkles size={12} /> {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <EditorContent editor={editor} />

      {detail.backlinks.length > 0 && (
        <div className="doc-backlinks">
          <h4>反向链接</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {detail.backlinks.map((backlink) => (
              <button
                key={backlink.id}
                className="palette-item"
                style={{ padding: '5px 0' }}
                onClick={() => void navigate({ to: '/docs/$docId', params: { docId: backlink.id } })}
              >
                <FileText size={12} />
                {backlink.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 48, fontSize: 10, color: 'var(--ink-4)' }}>
        创建于 {fullDateLabel(doc.createdAt.slice(0, 10))} · 文档正文保存在数据库
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="删除这篇文档？"
        description="子文档会一并删除。正文无法从界面恢复，但会保留在审计日志中。"
        busy={remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate({ id: doc.id, confirm: true })}
      />
    </div>
  )
}

function DocToolbar({ editor, onImage, onAi }: { editor: Editor; onImage: () => void; onAi: () => void }) {
  const btn = (active: boolean, onClick: () => void, title: string, icon: ReactNode) => (
    <button className={active ? 'on' : ''} onClick={onClick} title={title} type="button">
      {icon}
    </button>
  )
  return (
    <div className="doc-toolbar">
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), '加粗 ⌘B', <Bold size={14} />)}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), '斜体 ⌘I', <Italic size={14} />)}
      {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), '下划线 ⌘U', <UnderlineIcon size={14} />)}
      {btn(editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), '删除线', <Strikethrough size={14} />)}
      {btn(editor.isActive('code'), () => editor.chain().focus().toggleCode().run(), '行内代码', <Code size={14} />)}
      {btn(editor.isActive('highlight'), () => editor.chain().focus().toggleHighlight().run(), '高亮', <Highlighter size={14} />)}
      <span className="sep" />
      {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), '标题 1', <Heading1 size={15} />)}
      {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), '标题 2', <Heading2 size={15} />)}
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), '无序列表', <List size={15} />)}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), '有序列表', <ListOrdered size={15} />)}
      {btn(editor.isActive('taskList'), () => editor.chain().focus().toggleTaskList().run(), '待办列表', <ListChecks size={15} />)}
      {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), '引用', <Quote size={14} />)}
      {btn(editor.isActive('codeBlock'), () => editor.chain().focus().toggleCodeBlock().run(), '代码块', <Code size={15} />)}
      <span className="sep" />
      {btn(
        false,
        () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        '插入表格',
        <Table2 size={14} />,
      )}
      {btn(false, onImage, '插入图片', <ImageIcon size={14} />)}
      {btn(false, onAi, 'AI 润色 / 摘要', <Sparkles size={14} />)}
      {btn(
        editor.isActive('link'),
        () => {
          const url = window.prompt('链接地址')
          if (url) editor.chain().focus().setLink({ href: url }).run()
          else editor.chain().focus().unsetLink().run()
        },
        '链接',
        <Link2 size={14} />,
      )}
      <span className="sep" />
      {btn(false, () => editor.chain().focus().undo().run(), '撤销 ⌘Z', <Undo2 size={14} />)}
      {btn(false, () => editor.chain().focus().redo().run(), '重做 ⇧⌘Z', <Redo2 size={14} />)}
    </div>
  )
}
