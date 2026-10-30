import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Check, History, Loader2, Plus, Send, Sparkles, X } from 'lucide-react'
import type { ChatMessage, ChatResult, Conversation, Settings } from '@daily/contracts'
import { useOp } from '@/lib/query'
import { callOp, streamAiChat } from '@/lib/api'
import { useUi } from '@/stores/ui'
import { relativeTime } from '@/lib/format'
import { toast } from '@/stores/toast'
import { useQueryClient } from '@tanstack/react-query'

interface AiStatus {
  enabled: boolean
  configured: boolean
  provider: { name: string; model: string; baseUrl: string } | null
}

type ToolStatus = 'executed' | 'requires_confirmation' | 'failed' | 'running'
interface ToolCallView {
  name: string
  input: unknown
  result?: unknown
  status: ToolStatus
}

interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCallView[]
  failed?: boolean
}

const SUGGESTIONS = [
  '帮我规划今天，先看容量和逾期',
  '我这周做得怎么样？给我三点复盘',
  '把收件箱里的速记整理成任务建议',
  '根据当前项目，列出下一步最重要的三件事',
]

export function AIChatPanel() {
  const open = useUi((s) => s.aiOpen)
  const setOpen = useUi((s) => s.setAiOpen)
  const aiContext = useUi((s) => s.aiContext)
  const aiDraft = useUi((s) => s.aiDraft)
  const consumeAiDraft = useUi((s) => s.consumeAiDraft)
  const openAi = useUi((s) => s.openAi)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: status } = useOp<AiStatus>('ai.status', {}, { enabled: open })
  const { data: settings } = useOp<Settings>('settings.get', {}, { enabled: open })
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const { data: conversations } = useOp<Conversation[]>(
    'ai.conversations.list',
    { limit: 30 },
    { enabled: open && historyOpen },
  )
  const [allowActions, setAllowActions] = useState(
    () => localStorage.getItem('daily:ai-actions') === '1',
  )
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    const draft = consumeAiDraft()
    if (draft) setInput(draft)
    setTimeout(() => inputRef.current?.focus(), 80)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, aiDraft])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, busy])

  useEffect(() => {
    localStorage.setItem('daily:ai-actions', allowActions ? '1' : '0')
  }, [allowActions])

  if (!open) return null

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim()
    if (!text || busy) return
    if (!status?.configured) {
      toast.error('请先在设置中配置 AI 供应商')
      return
    }
    setHistoryOpen(false)
    const assistantId = `stream-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: 'user', content: text },
      { id: assistantId, role: 'assistant', content: '', toolCalls: [] },
    ])
    setInput('')
    setBusy(true)
    const updateAssistant = (updater: (message: UIMessage) => UIMessage) => {
      setMessages((prev) => prev.map((message) => (message.id === assistantId ? updater(message) : message)))
    }
    try {
      await streamAiChat(
        {
          message: text,
          conversationId,
          confirmTools: allowActions,
          context: aiContext,
        },
        (event) => {
          if (event.type === 'start' && event.conversationId) {
            setConversationId(event.conversationId)
          } else if (event.type === 'delta' && event.text) {
            updateAssistant((message) => ({ ...message, content: message.content + event.text }))
          } else if (event.type === 'tool_start' && event.name) {
            updateAssistant((message) => ({
              ...message,
              toolCalls: [
                ...(message.toolCalls ?? []),
                { name: event.name!, input: event.input, status: 'running' as ToolStatus },
              ],
            }))
          } else if (event.type === 'tool_result' && event.name) {
            updateAssistant((message) => {
              const calls = [...(message.toolCalls ?? [])]
              const index = calls.map((call) => call.name).lastIndexOf(event.name!)
              const next = {
                name: event.name!,
                input: index >= 0 ? calls[index]!.input : undefined,
                result: event.result,
                status: (event.status ?? 'executed') as ToolStatus,
              }
              if (index >= 0) calls[index] = next
              else calls.push(next)
              return { ...message, toolCalls: calls }
            })
          } else if (event.type === 'done') {
            const result = (event as unknown as { result?: ChatResult }).result
            if (result) {
              setConversationId(result.conversationId)
              updateAssistant(() => ({
                id: result.message.id,
                role: 'assistant',
                content: result.message.content,
                toolCalls: result.toolCalls as ToolCallView[],
              }))
            }
            void queryClient.invalidateQueries()
          } else if (event.type === 'error') {
            updateAssistant((message) => ({
              ...message,
              content: message.content || event.message || 'AI 请求失败',
              failed: true,
            }))
          }
        },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 请求失败'
      updateAssistant((current) => ({
        ...current,
        content: current.content || message,
        failed: true,
      }))
    } finally {
      setBusy(false)
    }
  }

  const newChat = () => {
    setMessages([])
    setConversationId(undefined)
    setInput('')
    setHistoryOpen(false)
    openAi()
    inputRef.current?.focus()
  }

  const disabled = !status?.configured || !settings?.general.aiEnabled

  return (
    <>
      <div className="scrim" onClick={() => setOpen(false)} />
      <aside className="ai-panel" aria-label="AI 助理">
        <div className="ai-head">
          <span className="ai-avatar" style={{ width: 28, height: 28 }}>
            <Sparkles size={14} />
          </span>
          <div>
            <div className="title">AI 助理</div>
            <div className="sub">
              {status?.provider ? `${status.provider.name} · ${status.provider.model}` : '尚未配置供应商'}
            </div>
          </div>
          <div className="actions">
            <button
              className="icon-btn ghost"
              style={{ width: 28, height: 28 }}
              onClick={() => setHistoryOpen((v) => !v)}
              title="对话记录"
            >
              <History size={15} />
            </button>
            <button className="icon-btn ghost" style={{ width: 28, height: 28 }} onClick={newChat} title="新对话">
              <Plus size={15} />
            </button>
            <button className="icon-btn ghost" style={{ width: 28, height: 28 }} onClick={() => setOpen(false)} title="关闭">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="ai-body">
          {historyOpen && (
            <div className="ai-history">
              <div className="ai-history-head">
                <History size={12} /> 最近的对话
                <button className="icon-btn ghost" style={{ width: 22, height: 22, marginLeft: 'auto' }} onClick={() => setHistoryOpen(false)}>
                  <X size={12} />
                </button>
              </div>
              {(conversations ?? []).length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--ink-3)', padding: '8px 2px' }}>还没有对话记录。</div>
              )}
              {(conversations ?? []).map((conversation) => (
                <button
                  key={conversation.id}
                  className="ai-history-item"
                  onClick={async () => {
                    try {
                      const detail = await callOp<{ conversation: Conversation; messages: ChatMessage[] }>(
                        'ai.conversations.get',
                        { id: conversation.id },
                      )
                      setConversationId(detail.conversation.id)
                      setMessages(
                        detail.messages
                          .filter((message) => message.role === 'user' || message.role === 'assistant')
                          .map((message) => ({
                            id: message.id,
                            role: message.role as 'user' | 'assistant',
                            content: message.content,
                          })),
                      )
                      setHistoryOpen(false)
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : '无法读取对话')
                    }
                  }}
                >
                  <span className="t">{conversation.title}</span>
                  <span className="when">{relativeTime(conversation.updatedAt)}</span>
                </button>
              ))}
            </div>
          )}

          {!historyOpen && messages.length === 0 && (
            <div className="ai-welcome">
              <h2>今天想推进什么？</h2>
              <p>
                我会先读你的任务、容量与最近记录，再给建议。默认只读；需要我执行变更时，打开下方的开关。
              </p>
              {disabled ? (
                <div className="ai-empty-provider">
                  {!settings?.general.aiEnabled
                    ? 'AI 功能已在设置中关闭。'
                    : '还没有配置 AI 供应商。'}
                  <div style={{ marginTop: 8 }}>
                    <button
                      className="btn sm"
                      onClick={() => {
                        setOpen(false)
                        void navigate({ to: '/settings' })
                      }}
                    >
                      去设置
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ai-suggestions">
                  {SUGGESTIONS.map((suggestion) => (
                    <button key={suggestion} className="ai-suggestion" onClick={() => void send(suggestion)}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!historyOpen && messages.map((message) => message.content || message.failed || (message.toolCalls?.length ?? 0) > 0 ? (
            <div key={message.id} className={`ai-msg ${message.role}`}>
              {message.role === 'assistant' && (
                <span className="ai-avatar">
                  <Sparkles size={12} />
                </span>
              )}
              <div className="ai-bubble">
                {message.failed ? (
                  <div style={{ color: 'var(--danger)', display: 'flex', gap: 6 }}>
                    <AlertTriangle size={13} style={{ marginTop: 3, flex: 'none' }} />
                    <span>{message.content}</span>
                  </div>
                ) : message.role === 'assistant' ? (
                  renderMarkdown(message.content)
                ) : (
                  message.content
                )}
                {message.toolCalls && message.toolCalls.length > 0 && (
                  <div className="ai-tools">
                    {message.toolCalls.map((tool, index) => (
                      <span
                        key={`${tool.name}-${index}`}
                        className={`ai-tool ${tool.status === 'executed' ? 'ok' : tool.status === 'running' ? '' : tool.status === 'requires_confirmation' ? 'warn' : 'fail'}`}
                        title={JSON.stringify(tool.result ?? tool.input).slice(0, 500)}
                      >
                        {tool.status === 'executed' ? <Check size={9} /> : tool.status === 'running' ? <Loader2 size={9} className="spin" /> : <AlertTriangle size={9} />}
                        {tool.name}
                        {tool.status === 'requires_confirmation' ? ' · 待确认' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null)}

          {!historyOpen && busy && (
            <div className="ai-thinking">
              <Loader2 size={12} className="spin" /> 正在读取数据并思考…
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="ai-foot">
          <div className="ai-composer">
            <textarea
              ref={inputRef}
              value={input}
              disabled={disabled || busy}
              placeholder={disabled ? '配置 AI 供应商后即可对话' : '问点什么，或让我整理…（Enter 发送，Shift+Enter 换行）'}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  void send()
                }
              }}
            />
            <div className="ai-composer-foot">
              <button
                className="ai-toggle"
                onClick={() => setAllowActions((v) => !v)}
                title="允许 AI 创建、更新或完成任务；破坏性操作仍需手动确认"
              >
                <span className={`toggle ${allowActions ? 'on' : ''}`} style={{ width: 30, height: 17 }}>
                  <i style={{ width: 11, height: 11 }} />
                </span>
                允许执行变更
              </button>
              <button className="ai-send" onClick={() => void send()} disabled={!input.trim() || busy || disabled} aria-label="发送">
                <Send size={13} />
              </button>
            </div>
          </div>
          <div style={{ fontSize: 9, color: 'var(--ink-4)', marginTop: 6, textAlign: 'center' }}>
            AI 可能出错，重要操作请核对。数据会发送到你配置的模型供应商。
          </div>
        </div>
      </aside>
    </>
  )
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index}>{part.slice(1, -1)}</code>
    }
    return <span key={index}>{part}</span>
  })
}

function renderMarkdown(text: string): ReactNode {
  const blocks = text.split(/```/)
  return blocks.map((block, blockIndex) => {
    if (blockIndex % 2 === 1) {
      return <pre key={blockIndex}>{block.replace(/^\w+\n/, '')}</pre>
    }
    const lines = block.split('\n')
    const nodes: ReactNode[] = []
    let list: { ordered: boolean; items: string[] } | null = null
    const flush = () => {
      if (!list) return
      const Tag = list.ordered ? 'ol' : 'ul'
      nodes.push(
        <Tag key={`list-${nodes.length}`}>
          {list.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </Tag>,
      )
      list = null
    }
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        flush()
        continue
      }
      const bullet = trimmed.match(/^[-*]\s+(.*)$/)
      const ordered = trimmed.match(/^\d+[.)]\s+(.*)$/)
      const heading = trimmed.match(/^(#{1,3})\s+(.*)$/)
      if (bullet) {
        if (!list || list.ordered) {
          flush()
          list = { ordered: false, items: [] }
        }
        list.items.push(bullet[1]!)
        continue
      }
      if (ordered) {
        if (!list || !list.ordered) {
          flush()
          list = { ordered: true, items: [] }
        }
        list.items.push(ordered[1]!)
        continue
      }
      flush()
      if (heading) {
        const level = heading[1]!.length
        nodes.push(
          <p key={`h-${nodes.length}`} style={{ fontWeight: 650, fontSize: level === 1 ? 15 : 13.5 }}>
            {renderInline(heading[2]!)}
          </p>,
        )
      } else {
        nodes.push(<p key={`p-${nodes.length}`}>{renderInline(trimmed)}</p>)
      }
    }
    flush()
    return <div key={blockIndex}>{nodes}</div>
  })
}
