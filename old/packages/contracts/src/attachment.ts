import { z } from 'zod'
import { Id } from './common.js'

export const OwnerType = z.enum(['task', 'document', 'memo'])
export type OwnerType = z.infer<typeof OwnerType>

export const AttachmentSchema = z.object({
  id: Id,
  ownerType: OwnerType,
  ownerId: Id,
  filename: z.string(),
  mime: z.string(),
  size: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  sortOrder: z.number(),
  createdAt: z.string(),
  url: z.string(),
  thumbUrl: z.string().nullable(),
})
export type Attachment = z.infer<typeof AttachmentSchema>

export const ListAttachmentsInput = z.object({
  ownerType: OwnerType,
  ownerId: Id,
})
export type ListAttachmentsInput = z.infer<typeof ListAttachmentsInput>

export const AttachmentRefInput = z.object({ id: Id })
export type AttachmentRefInput = z.infer<typeof AttachmentRefInput>

export const AttachmentStats = z.object({
  count: z.number().int(),
  bytes: z.number().int(),
})
