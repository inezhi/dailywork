import { z } from 'zod'
import { DateOnly, Id } from './common.js'

export const ThemeMode = z.enum(['light', 'dark', 'system'])
export type ThemeMode = z.infer<typeof ThemeMode>

export const ThemeSettings = z.object({
  mode: ThemeMode,
  accent: z.string(),
  success: z.string(),
  warning: z.string(),
  danger: z.string(),
  info: z.string(),
  neutral: z.enum(['warm', 'neutral', 'cool']),
  density: z.enum(['comfortable', 'compact']),
})
export type ThemeSettings = z.infer<typeof ThemeSettings>

export const GeneralSettings = z.object({
  weekStartsOn: z.number().int().min(0).max(6),
  defaultFocusMinutes: z.number().int().min(1).max(180),
  defaultCapacityMinutes: z.number().int().min(0).max(1440),
  aiEnabled: z.boolean(),
  lanEnabled: z.boolean(),
  reduceMotion: z.boolean(),
})
export type GeneralSettings = z.infer<typeof GeneralSettings>

export const SettingsSchema = z.object({
  theme: ThemeSettings,
  general: GeneralSettings,
})
export type Settings = z.infer<typeof SettingsSchema>

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  mode: 'light',
  accent: '#1677FF',
  success: '#52C41A',
  warning: '#FAAD14',
  danger: '#FF4D4F',
  info: '#13C2C2',
  neutral: 'cool',
  density: 'comfortable',
}

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  weekStartsOn: 1,
  defaultFocusMinutes: 25,
  defaultCapacityMinutes: 300,
  aiEnabled: true,
  lanEnabled: false,
  reduceMotion: false,
}

export const DEFAULT_SETTINGS: Settings = {
  theme: DEFAULT_THEME_SETTINGS,
  general: DEFAULT_GENERAL_SETTINGS,
}

export const UpdateSettingsInput = z.object({
  theme: ThemeSettings.partial().optional(),
  general: GeneralSettings.partial().optional(),
})
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsInput>

export const DashboardInput = z.object({
  range: z.enum(['7d', '30d', '90d', '12w']).default('30d'),
})
export type DashboardInput = z.infer<typeof DashboardInput>

export const DashboardKpi = z.object({
  completed: z.number().int(),
  created: z.number().int(),
  completionRate: z.number(),
  focusMinutes: z.number().int(),
  overdue: z.number().int(),
  activeProjects: z.number().int(),
  onTimeRate: z.number(),
  averageEstimateError: z.number(),
})

export const TrendPoint = z.object({
  date: DateOnly,
  completed: z.number().int(),
  created: z.number().int(),
  focusMinutes: z.number().int(),
})

export const DashboardResult = z.object({
  range: z.string(),
  from: DateOnly,
  to: DateOnly,
  kpi: DashboardKpi,
  trend: z.array(TrendPoint),
  byStatus: z.array(z.object({ status: z.string(), count: z.number().int() })),
  byProject: z.array(
    z.object({
      projectId: Id.nullable(),
      name: z.string(),
      color: z.string(),
      completed: z.number().int(),
      open: z.number().int(),
      minutes: z.number().int(),
    }),
  ),
  bySpace: z.array(
    z.object({ spaceId: Id, name: z.string(), color: z.string(), open: z.number().int() }),
  ),
  insights: z.array(
    z.object({
      id: z.string(),
      tone: z.enum(['neutral', 'positive', 'warning']),
      title: z.string(),
      body: z.string(),
      actionLabel: z.string().nullable(),
      actionView: z.string().nullable(),
    }),
  ),
  needsAttention: z.array(
    z.object({
      taskId: Id,
      title: z.string(),
      reason: z.enum(['overdue', 'stale', 'blocked', 'due-today']),
      date: DateOnly.nullable(),
      days: z.number().int(),
    }),
  ),
})
export type DashboardResult = z.infer<typeof DashboardResult>

export const HealthResult = z.object({
  ok: z.boolean(),
  version: z.string(),
  dataDir: z.string(),
  database: z.string(),
  uptimeSeconds: z.number().int(),
  taskCount: z.number().int(),
})
export type HealthResult = z.infer<typeof HealthResult>

export const MetaInfo = z.object({
  version: z.string(),
  builtAt: z.string(),
  schemaVersion: z.number().int(),
  platform: z.string(),
  dataDir: z.string(),
  lanUrls: z.array(z.string()),
})
export type MetaInfo = z.infer<typeof MetaInfo>

export const BackupFileInput = z.object({
  targetPath: z.string().max(1000).optional(),
})
export const BackupFileResult = z.object({
  path: z.string(),
  bytes: z.number().int(),
})

export const ImportInput = z.object({
  sourcePath: z.string().max(1000),
  replaceExisting: z.boolean().default(true),
})
export const ImportResult = z.object({
  restored: z.boolean(),
  restartRequired: z.boolean().optional(),
  tasks: z.number().int(),
  projects: z.number().int(),
  documents: z.number().int(),
  backupPath: z.string().nullable(),
})
export type ImportResult = z.infer<typeof ImportResult>
