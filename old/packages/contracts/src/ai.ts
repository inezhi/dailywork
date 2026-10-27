import { z } from 'zod'
import { Id, IsoDateTime } from './common.js'

export const ProviderSchema = z.object({
  id: Id,
  name: z.string(),
  baseUrl: z.string(),
  model: z.string(),
  hasKey: z.boolean(),
  isDefault: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
})
export type Provider = z.infer<typeof ProviderSchema>

export const SaveProviderInput = z.object({
  id: Id.optional(),
  name: z.string().trim().min(1).max(60),
  baseUrl: z.string().url().max(500),
  model: z.string().trim().min(1).max(120),
  apiKey: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
})
export type SaveProviderInput = z.infer<typeof SaveProviderInput>

export const ProviderRefInput = z.object({ id: Id })
export type ProviderRefInput = z.infer<typeof ProviderRefInput>

export const ChatRole = z.enum(['user', 'assistant', 'system', 'tool'])
export type ChatRole = z.infer<typeof ChatRole>

export const ConversationSchema = z.object({
  id: Id,
  title: z.string(),
  contextKind: z.string(),
  contextId: Id.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
})
export type Conversation = z.infer<typeof ConversationSchema>

export const ChatMessageSchema = z.object({
  id: Id,
  conversationId: Id,
  role: ChatRole,
  content: z.string(),
  toolName: z.string().nullable(),
  createdAt: IsoDateTime,
})
export type ChatMessage = z.infer<typeof ChatMessageSchema>

export const ChatInput = z.object({
  conversationId: Id.optional(),
  message: z.string().trim().min(1).max(20_000),
  context: z
    .object({
      kind: z.enum(['global', 'task', 'document', 'project', 'review']).default('global'),
      id: Id.optional(),
    })
    .optional(),
  confirmTools: z.boolean().optional(),
})
export type ChatInput = z.infer<typeof ChatInput>

export const ChatResult = z.object({
  conversationId: Id,
  message: ChatMessageSchema,
  toolCalls: z.array(
    z.object({
      name: z.string(),
      input: z.unknown(),
      result: z.unknown().optional(),
      status: z.enum(['executed', 'requires_confirmation', 'failed']),
    }),
  ),
})
export type ChatResult = z.infer<typeof ChatResult>

export const ListConversationsInput = z.object({ limit: z.number().int().min(1).max(100).default(30) })

export const ConversationDetail = z.object({
  conversation: ConversationSchema,
  messages: z.array(ChatMessageSchema),
})

export const TestProviderInput = z.object({ id: Id.optional() })
export const TestProviderResult = z.object({
  ok: z.boolean(),
  message: z.string(),
  latencyMs: z.number().int().optional(),
  model: z.string().optional(),
})
export type TestProviderResult = z.infer<typeof TestProviderResult>
