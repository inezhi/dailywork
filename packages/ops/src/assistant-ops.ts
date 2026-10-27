import { z } from 'zod'
import {
  ChatInput,
  ConversationDetail,
  ConversationSchema,
  Id,
  ListConversationsInput,
  OpError,
  type ChatMessage,
  type ChatResult,
} from '@daily/contracts'
import {
  addMessage,
  chatCompletion,
  chatCompletionStream,
  conversationDto,
  createConversation,
  getConversation,
  listConversations,
  listMessages,
  providerInfo,
  renameConversation,
  resolveProvider,
  type ChatTool,
  type LlmMessage,
} from '@daily/context-assistant'
import { getSettings } from '@daily/context-workspace'
import { getTask } from '@daily/context-tasking'
import { getDocumentDetail } from '@daily/context-documents'
import { getProject } from '@daily/context-projects'
import { weekReview } from '@daily/context-planning'
import { opMeta, runOp, defineOp, type AnyOpDefinition, type OpContext } from './core.js'

const MAX_TOOL_ROUNDS = 5
const MAX_TOOL_RESULT_CHARS = 6000

export type AssistantToolStatus = 'executed' | 'requires_confirmation' | 'failed'

export interface AssistantToolSummary {
  name: string
  input: unknown
  result?: unknown
  status: AssistantToolStatus
}

export interface AssistantChatEvent {
  type: 'start' | 'delta' | 'tool_start' | 'tool_result'
  conversationId?: string
  text?: string
  name?: string
  input?: unknown
  result?: unknown
  status?: AssistantToolStatus
}

export interface AssistantChatOptions {
  stream?: boolean
  onEvent?: (event: AssistantChatEvent) => void | Promise<void>
}

function toolName(opName: string): string {
  return opName.replaceAll('.', '_')
}

function buildSystemPrompt(ctx: OpContext, input: z.infer<typeof ChatInput>): string {
  const lines = [
    '你是「时序 Dailywork」工作台里的 AI 助理。',
    `今天是 ${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}。`,
    '',
    '工作原则：',
    '1. 中文回答，语气克制、具体，不夸张。用短段落和必要列表，避免长篇大论。',
    '2. 需要事实时必须先调用工具查询；绝不编造任务、日期、数字或项目。',
    '3. 创建、更新、完成、删除等变更操作，只有当用户明确开启「允许执行变更」时才能执行；否则只提出建议。',
    '4. 如果工具返回 CONFIRM_REQUIRED 或失败，如实说明，不要假装成功。',
    '5. 一次创建任务不超过 5 个；批量操作前先用一句话复述将要做什么。',
    '6. 回答「今天做什么」时，结合容量、逾期和进行中的任务，给出 1–3 个最小下一步。',
    '7. 不确定时先问一个澄清问题，而不是猜。',
  ]
  if (input.context && input.context.kind !== 'global') {
    try {
      if (input.context.kind === 'task' && input.context.id) {
        const task = getTask(ctx.db, input.context.id)
        lines.push(
          '',
          '当前正在看的任务：',
          JSON.stringify({
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            scheduledDate: task.scheduledDate,
            dueDate: task.dueDate,
            estimateMinutes: task.estimateMinutes,
            project: task.projectName,
            tags: task.tags.map((t) => t.name),
            notes: task.notes.slice(0, 2000),
          }),
        )
      } else if (input.context.kind === 'project' && input.context.id) {
        const project = getProject(ctx.db, input.context.id)
        lines.push(
          '',
          '当前项目：',
          JSON.stringify({
            id: project.id,
            name: project.name,
            description: project.description,
            dueDate: project.dueDate,
            taskTotal: project.taskTotal,
            taskDone: project.taskDone,
            acceptanceCriteria: project.acceptanceCriteria.slice(0, 2000),
          }),
        )
      } else if (input.context.kind === 'document' && input.context.id) {
        const detail = getDocumentDetail(ctx.db, input.context.id)
        lines.push(
          '',
          '当前文档：',
          JSON.stringify({
            title: detail.document.title,
            text: detail.body.text.slice(0, 4000),
          }),
        )
      } else if (input.context.kind === 'review') {
        lines.push('', '用户正在做每周复盘。以下是本周数据：', JSON.stringify(weekReview(ctx.db)).slice(0, 5000))
      }
    } catch {
      // context is best-effort; do not fail the chat if it was deleted
    }
  }
  return lines.join('\n')
}

function buildTools(ops: AnyOpDefinition[]): { tools: ChatTool[]; byName: Map<string, AnyOpDefinition> } {
  const byName = new Map<string, AnyOpDefinition>()
  const tools: ChatTool[] = []
  for (const op of ops) {
    if (!op.exposure.ai) continue
    const meta = opMeta(op)
    const name = toolName(op.name)
    byName.set(name, op)
    tools.push({
      type: 'function',
      function: {
        name,
        description: `${meta.summary}（操作名 ${op.name}${meta.annotations.destructive ? '，破坏性' : ''}${meta.annotations.readOnly ? '，只读' : ''}）`,
        parameters: meta.inputSchema,
      },
    })
  }
  return { tools, byName }
}

function toChatMessage(row: {
  id: string
  conversation_id: string
  role: string
  content: string
  tool_name: string | null
  created_at: string
}): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as ChatMessage['role'],
    content: row.content,
    toolName: row.tool_name,
    createdAt: row.created_at,
  }
}

export async function runAssistantChat(
  ctx: OpContext,
  input: z.infer<typeof ChatInput>,
  ops: AnyOpDefinition[],
  options: AssistantChatOptions = {},
): Promise<ChatResult> {
  const emit = async (event: AssistantChatEvent) => {
    if (options.onEvent) await options.onEvent(event)
  }
  const settings = getSettings(ctx.db)
  if (!settings.general.aiEnabled) {
    throw new OpError('AI_DISABLED', 'AI 功能已在设置中关闭')
  }
  const provider = resolveProvider(ctx.db, ctx.dataDir)
  const conversation = input.conversationId
    ? getConversation(ctx.db, input.conversationId)
    : createConversation(ctx.db, {
        contextKind: input.context?.kind ?? 'global',
        contextId: input.context?.id ?? null,
      })
  const history = listMessages(ctx.db, conversation.id, 30)
  if (history.length === 0) {
    renameConversation(ctx.db, conversation.id, input.message.slice(0, 40))
  }
  addMessage(ctx.db, {
    conversationId: conversation.id,
    role: 'user',
    content: input.message,
  })
  await emit({ type: 'start', conversationId: conversation.id })

  const { tools, byName } = buildTools(ops)
  const messages: LlmMessage[] = [
    { role: 'system', content: buildSystemPrompt(ctx, input) },
    ...history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: input.message },
  ]
  const summary: AssistantToolSummary[] = []
  let finalContent = ''
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = options.stream
      ? await chatCompletionStream(provider, messages, tools, {
          onDelta: async (text) => emit({ type: 'delta', text }),
        })
      : await chatCompletion(provider, messages, tools)
    if (completion.toolCalls.length === 0) {
      finalContent = completion.content ?? ''
      break
    }
    messages.push({
      role: 'assistant',
      content: completion.content,
      tool_calls: completion.toolCalls,
    })
    for (const call of completion.toolCalls) {
      const op = byName.get(call.function.name)
      let args: Record<string, unknown> = {}
      let argError: string | null = null
      try {
        args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
      } catch {
        argError = '工具参数不是合法 JSON'
      }
      let toolResult: unknown
      let status: AssistantToolStatus = 'executed'
      if (!op) {
        status = 'failed'
        toolResult = { ok: false, error: { code: 'NOT_FOUND', message: '未知工具' } }
      } else if (argError) {
        status = 'failed'
        toolResult = { ok: false, error: { code: 'VALIDATION_ERROR', message: argError } }
      } else if (opMeta(op).annotations.destructive) {
        status = 'requires_confirmation'
        toolResult = {
          ok: false,
          error: {
            code: 'CONFIRM_REQUIRED',
            message: '破坏性操作不能由 AI 自行确认。请让用户在界面中手动执行或明确授权。',
          },
        }
      } else if (op.kind === 'command' && !input.confirmTools) {
        status = 'requires_confirmation'
        toolResult = {
          ok: false,
          error: {
            code: 'CONFIRM_REQUIRED',
            message: '用户尚未开启「允许执行变更」。请先说明将要做的变更，等待用户开启后再执行。',
          },
        }
      } else {
        try {
          await emit({ type: 'tool_start', name: op.name, input: args })
          const result = await runOp(op, { ...ctx, actor: 'ai', source: 'ai' }, args)
          toolResult = result.envelope
          if (!result.envelope.ok) status = 'failed'
        } catch (error) {
          status = 'failed'
          toolResult = {
            ok: false,
            error: { code: 'INTERNAL', message: error instanceof Error ? error.message : String(error) },
          }
        }
      }
      const serialized = JSON.stringify(toolResult)
      const summaryItem: AssistantToolSummary = {
        name: op?.name ?? call.function.name,
        input: args,
        result:
          serialized.length > 2000
            ? { truncated: true, preview: serialized.slice(0, 2000) }
            : toolResult,
        status,
      }
      summary.push(summaryItem)
      await emit({
        type: 'tool_result',
        name: summaryItem.name,
        result: summaryItem.result,
        status,
      })
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content:
          serialized.length > MAX_TOOL_RESULT_CHARS
            ? serialized.slice(0, MAX_TOOL_RESULT_CHARS) + '…（已截断）'
            : serialized,
      })
    }
    if (round === MAX_TOOL_ROUNDS - 1) {
      finalContent =
        completion.content ||
        '我已经完成了前面几步查询与操作。需要我继续整理或给出下一步建议吗？'
    }
  }
  if (!finalContent.trim()) {
    finalContent = summary.some((s) => s.status === 'executed')
      ? '操作已完成。还需要我继续整理吗？'
      : '我需要更多信息才能继续。'
  }
  const assistantRow = addMessage(ctx.db, {
    conversationId: conversation.id,
    role: 'assistant',
    content: finalContent,
  })
  return {
    conversationId: conversation.id,
    message: toChatMessage(assistantRow),
    toolCalls: summary,
  }
}

export function createAiOps(getOps: () => AnyOpDefinition[]): AnyOpDefinition[] {
  return [
    defineOp({
      name: 'ai.chat',
      version: 1,
      kind: 'command',
      summary: '与 AI 助理对话，可调用工作台工具',
      description:
        '发送一条消息并等待模型回复。勾选 confirmTools 后，AI 可以执行非破坏性的变更操作。',
      input: ChatInput,
      exposure: { http: true, cli: ['ai', 'chat'], mcp: false, ai: false },
      annotations: { idempotent: false },
      aggregate: 'ai',
      handler: (ctx, input) => runAssistantChat(ctx, input, getOps()),
    }),
    defineOp({
      name: 'ai.conversations.list',
      version: 1,
      kind: 'query',
      summary: '列出 AI 对话',
      input: ListConversationsInput,
      exposure: { http: true, cli: ['ai', 'conversations', 'list'], mcp: true, ai: false },
      aggregate: 'ai',
      handler: (ctx, input) => listConversations(ctx.db, input.limit),
    }),
    defineOp({
      name: 'ai.conversations.get',
      version: 1,
      kind: 'query',
      summary: '读取一条 AI 对话与消息',
      input: z.object({ id: Id }),
      exposure: { http: true, cli: ['ai', 'conversations', 'get'], mcp: true, ai: false },
      aggregate: 'ai',
      handler: (ctx, input) => {
        const conversation = getConversation(ctx.db, input.id)
        return {
          conversation: conversationDto(conversation),
          messages: listMessages(ctx.db, input.id, 200).map(toChatMessage),
        }
      },
    }),
    defineOp({
      name: 'ai.status',
      version: 1,
      kind: 'query',
      summary: 'AI 是否可用与默认模型',
      input: z.object({}),
      exposure: { http: true, cli: ['ai', 'status'], mcp: true, ai: false },
      aggregate: 'ai',
      handler: (ctx) => {
        const settings = getSettings(ctx.db)
        const info = providerInfo(ctx.db)
        return {
          enabled: settings.general.aiEnabled,
          configured: Boolean(info?.hasKey),
          provider: info
            ? { name: info.name, model: info.model, baseUrl: info.baseUrl }
            : null,
        }
      },
    }),
  ] as AnyOpDefinition[]
}

export { ConversationSchema, ConversationDetail }
