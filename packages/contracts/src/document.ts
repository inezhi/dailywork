import { z } from 'zod'
import { Id, IsoDateTime, Pagination } from './common.js'

export const DocumentSchema = z.object({
  id: Id,
  parentId: Id.nullable(),
  spaceId: Id.nullable(),
  projectId: Id.nullable(),
  taskId: Id.nullable(),
  title: z.string(),
  icon: z.string(),
  excerpt: z.string(),
  sortOrder: z.number(),
  archivedAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  childCount: z.number().int().optional(),
})
export type Document = z.infer<typeof DocumentSchema>

export const DocumentBodySchema = z.object({
  documentId: Id,
  content: z.unknown(),
  text: z.string(),
  updatedAt: IsoDateTime,
})
export type DocumentBody = z.infer<typeof DocumentBodySchema>

export const DocumentDetail = z.object({
  document: DocumentSchema,
  body: DocumentBodySchema,
  backlinks: z.array(DocumentSchema),
})
export type DocumentDetail = z.infer<typeof DocumentDetail>

export const CreateDocumentInput = z.object({
  title: z.string().trim().max(300).optional(),
  parentId: Id.nullish(),
  spaceId: Id.nullish(),
  projectId: Id.nullish(),
  taskId: Id.nullish(),
  icon: z.string().max(16).optional(),
  content: z.unknown().optional(),
})
export type CreateDocumentInput = z.infer<typeof CreateDocumentInput>

export const UpdateDocumentInput = z.object({
  id: Id,
  title: z.string().trim().max(300).optional(),
  icon: z.string().max(16).optional(),
  parentId: Id.nullish(),
  spaceId: Id.nullish(),
  projectId: Id.nullish(),
  taskId: Id.nullish(),
  sortOrder: z.number().optional(),
})
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentInput>

export const SaveDocumentBodyInput = z.object({
  id: Id,
  content: z.unknown(),
  text: z.string().max(2_000_000).optional(),
})
export type SaveDocumentBodyInput = z.infer<typeof SaveDocumentBodyInput>

export const ListDocumentsInput = z.object({
  spaceId: Id.optional(),
  projectId: Id.optional(),
  taskId: Id.optional(),
  parentId: Id.optional(),
  search: z.string().max(200).optional(),
  includeArchived: z.boolean().optional(),
})
export type ListDocumentsInput = z.infer<typeof ListDocumentsInput>

export const DocumentRefInput = z.object({ id: Id })
export type DocumentRefInput = z.infer<typeof DocumentRefInput>

export const SearchAllInput = z.object({
  query: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(50).default(20),
})
export type SearchAllInput = z.infer<typeof SearchAllInput>

export const SearchHit = z.object({
  kind: z.enum(['task', 'memo', 'document', 'project']),
  id: Id,
  title: z.string(),
  snippet: z.string(),
  meta: z.string(),
  score: z.number(),
})
export type SearchHit = z.infer<typeof SearchHit>

export const PagedDocuments = z.object({
  items: z.array(DocumentSchema),
  total: z.number().int(),
  page: Pagination.shape,
})
