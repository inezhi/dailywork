import { z } from 'zod'
import {
  ListAttachmentsInput,
  AttachmentRefInput,
  AttachmentStats,
} from '@daily/contracts'
import {
  attachmentStats,
  deleteAttachment,
  listAttachments,
} from '@daily/attachments'
import { defineOp } from './core.js'

export const attachmentOps = [
  defineOp({
    name: 'attachment.list',
    version: 1,
    kind: 'query',
    summary: '列出某个任务或文档的附件',
    input: ListAttachmentsInput,
    exposure: { http: true, cli: ['attachment', 'list'], mcp: true, ai: true },
    aggregate: 'task',
    handler: (ctx, input) => listAttachments(ctx.db, input.ownerType, input.ownerId),
  }),
  defineOp({
    name: 'attachment.delete',
    version: 1,
    kind: 'command',
    summary: '删除附件并在无引用时清理图片数据',
    input: AttachmentRefInput,
    exposure: { http: true, cli: ['attachment', 'delete'], mcp: true, ai: true },
    annotations: { destructive: true, confirm: true },
    aggregate: 'task',
    handler: (ctx, input) => deleteAttachment(ctx.db, input.id),
  }),
  defineOp({
    name: 'attachment.stats',
    version: 1,
    kind: 'query',
    summary: '附件数量与占用空间',
    input: z.object({}),
    exposure: { http: true, cli: ['attachment', 'stats'], mcp: true, ai: true },
    aggregate: 'task',
    handler: (ctx) => attachmentStats(ctx.db),
  }),
]

export { AttachmentStats }
