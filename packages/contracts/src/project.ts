import { z } from 'zod'
import { DateOnly, Id, IsoDateTime, ProjectStatus } from './common.js'

export const SpaceSchema = z.object({
  id: Id,
  name: z.string(),
  color: z.string(),
  icon: z.string(),
  sortOrder: z.number(),
  archivedAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  projectCount: z.number().int().optional(),
  openTaskCount: z.number().int().optional(),
})
export type Space = z.infer<typeof SpaceSchema>

export const CreateSpaceInput = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(32).optional(),
})
export type CreateSpaceInput = z.infer<typeof CreateSpaceInput>

export const UpdateSpaceInput = z.object({
  id: Id,
  name: z.string().trim().min(1).max(40).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(32).optional(),
  archived: z.boolean().optional(),
})
export type UpdateSpaceInput = z.infer<typeof UpdateSpaceInput>

export const ProjectSchema = z.object({
  id: Id,
  spaceId: Id,
  name: z.string(),
  description: z.string(),
  color: z.string(),
  icon: z.string(),
  status: ProjectStatus,
  startDate: DateOnly.nullable(),
  dueDate: DateOnly.nullable(),
  acceptanceCriteria: z.string(),
  sortOrder: z.number(),
  archivedAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  taskTotal: z.number().int().optional(),
  taskDone: z.number().int().optional(),
  spaceName: z.string().nullable().optional(),
  spaceColor: z.string().nullable().optional(),
})
export type Project = z.infer<typeof ProjectSchema>

export const CreateProjectInput = z.object({
  name: z.string().trim().min(1).max(120),
  spaceId: Id.optional(),
  description: z.string().max(20_000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(32).optional(),
  status: ProjectStatus.optional(),
  startDate: DateOnly.nullish(),
  dueDate: DateOnly.nullish(),
  acceptanceCriteria: z.string().max(20_000).optional(),
})
export type CreateProjectInput = z.infer<typeof CreateProjectInput>

export const UpdateProjectInput = z.object({
  id: Id,
  name: z.string().trim().min(1).max(120).optional(),
  spaceId: Id.optional(),
  description: z.string().max(20_000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(32).optional(),
  status: ProjectStatus.optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  acceptanceCriteria: z.string().max(20_000).optional(),
})
export type UpdateProjectInput = z.infer<typeof UpdateProjectInput>

export const ListProjectsInput = z.object({
  spaceId: Id.optional(),
  status: z.array(ProjectStatus).optional(),
  includeArchived: z.boolean().optional(),
  search: z.string().max(200).optional(),
})
export type ListProjectsInput = z.infer<typeof ListProjectsInput>

export const ProjectRefInput = z.object({ id: Id })
export type ProjectRefInput = z.infer<typeof ProjectRefInput>

export const DeliverableSchema = z.object({
  id: Id,
  projectId: Id,
  title: z.string(),
  status: z.enum(['pending', 'done']),
  dueDate: DateOnly.nullable(),
  note: z.string(),
  sortOrder: z.number(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
})
export type Deliverable = z.infer<typeof DeliverableSchema>

export const CreateDeliverableInput = z.object({
  projectId: Id,
  title: z.string().trim().min(1).max(200),
  dueDate: DateOnly.nullish(),
  note: z.string().max(4000).optional(),
})
export type CreateDeliverableInput = z.infer<typeof CreateDeliverableInput>

export const UpdateDeliverableInput = z.object({
  id: Id,
  title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(['pending', 'done']).optional(),
  dueDate: DateOnly.nullish(),
  note: z.string().max(4000).optional(),
  sortOrder: z.number().optional(),
})
export type UpdateDeliverableInput = z.infer<typeof UpdateDeliverableInput>

export const DeliverableRefInput = z.object({ id: Id })
export type DeliverableRefInput = z.infer<typeof DeliverableRefInput>

export const TaskTemplateSchema = z.object({
  id: Id,
  name: z.string(),
  description: z.string(),
  spaceId: Id.nullable(),
  projectId: Id.nullable(),
  items: z.array(
    z.object({
      title: z.string(),
      estimateMinutes: z.number().int().nullable(),
      priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']),
    }),
  ),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
})
export type TaskTemplate = z.infer<typeof TaskTemplateSchema>

export const CreateTemplateInput = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(2000).optional(),
  projectId: Id.nullish(),
  items: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        estimateMinutes: z.number().int().min(0).max(1440).nullish(),
        priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
      }),
    )
    .min(1)
    .max(50),
})
export type CreateTemplateInput = z.infer<typeof CreateTemplateInput>

export const TemplateRefInput = z.object({ id: Id })
export type TemplateRefInput = z.infer<typeof TemplateRefInput>

export const ApplyTemplateInput = z.object({
  id: Id,
  projectId: Id.nullish(),
  scheduledDate: DateOnly.nullish(),
})
export type ApplyTemplateInput = z.infer<typeof ApplyTemplateInput>
