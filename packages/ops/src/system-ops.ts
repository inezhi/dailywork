import { z } from 'zod'
import {
  BackupFileInput,
  DashboardInput,
  ImportInput,
  HealthResult,
  Id,
  MetaInfo,
  SaveProviderInput,
  TestProviderResult,
  TestProviderInput,
  ProviderSchema,
} from '@daily/contracts'
import { dashboard } from '@daily/analytics'
import { getSettings } from '@daily/context-workspace'
import { listProviders, saveProvider, deleteProvider, testProvider, getProviderRow } from '@daily/context-assistant'
import { dataPaths, exportBackup, stageImport } from '@daily/platform'
import { networkInterfaces } from 'node:os'
import { defineOp } from './core.js'

const APP_VERSION = '0.1.0'
const startedAt = Date.now()

export const systemOps = [
  defineOp({
    name: 'backup.export',
    version: 1,
    kind: 'command',
    summary: '导出完整的 .dailywork 备份（数据库 + 图片 + 清单）',
    input: BackupFileInput,
    exposure: { http: true, cli: ['backup', 'export'], mcp: true, ai: false },
    annotations: { idempotent: false },
    aggregate: 'system',
    handler: (ctx, input) => exportBackup(ctx.db, ctx.dataDir, ctx.version, input.targetPath),
  }),
  defineOp({
    name: 'backup.import',
    version: 1,
    kind: 'command',
    summary: '校验并暂存备份，下次启动时原子恢复',
    input: ImportInput,
    exposure: { http: true, cli: ['backup', 'import'], mcp: true, ai: false },
    annotations: { destructive: true, confirm: true },
    aggregate: 'system',
    handler: (ctx, input) => {
      const inspection = stageImport(ctx.dataDir, input.sourcePath)
      return {
        restored: false,
        restartRequired: true,
        tasks: inspection.manifest.counts.tasks,
        projects: inspection.manifest.counts.projects,
        documents: inspection.manifest.counts.documents,
        backupPath: null,
      }
    },
  }),

  defineOp({
    name: 'analytics.dashboard',
    version: 1,
    kind: 'query',
    summary: '仪表盘 KPI、趋势、项目分布与洞察',
    input: DashboardInput,
    exposure: { http: true, cli: ['analytics', 'dashboard'], mcp: true, ai: true },
    aggregate: 'system',
    handler: (ctx, input) => dashboard(ctx.db, input),
  }),
  defineOp({
    name: 'meta.get',
    version: 1,
    kind: 'query',
    summary: '应用版本、数据目录与局域网地址',
    input: z.object({}),
    exposure: { http: true, cli: ['meta'], mcp: true, ai: false },
    aggregate: 'system',
    handler: (ctx): MetaInfo => {
      const paths = dataPaths(ctx.dataDir)
      return {
        version: APP_VERSION,
        builtAt: process.env.DAILYWORK_BUILT_AT ?? new Date().toISOString(),
        schemaVersion: 1,
        platform: process.platform,
        dataDir: paths.dataDir,
        lanUrls: [],
      }
    },
  }),
  defineOp({
    name: 'health.get',
    version: 1,
    kind: 'query',
    summary: '服务健康检查',
    input: z.object({}),
    exposure: { http: true, cli: ['health'], mcp: false, ai: false },
    aggregate: 'system',
    handler: (ctx): HealthResult => {
      const paths = dataPaths(ctx.dataDir)
      const count = ctx.db.prepare('SELECT COUNT(*) AS c FROM tasks').get() as { c: number }
      return {
        ok: true,
        version: APP_VERSION,
        dataDir: paths.dataDir,
        database: paths.dbFile,
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        taskCount: count.c,
      }
    },
  }),
  defineOp({
    name: 'lan.info',
    version: 1,
    kind: 'query',
    summary: '局域网访问地址与配对码',
    input: z.object({}),
    exposure: { http: true, cli: ['lan', 'info'], mcp: false, ai: false },
    aggregate: 'system',
    handler: (ctx) => {
      const settings = getSettings(ctx.db)
      const urls: string[] = []
      if (settings.general.lanEnabled && ctx.port) {
        for (const list of Object.values(networkInterfaces())) {
          for (const info of list ?? []) {
            if (info.family === 'IPv4' && !info.internal) {
              urls.push(`http://${info.address}:${ctx.port}`)
            }
          }
        }
      }
      return {
        enabled: settings.general.lanEnabled,
        urls,
        port: ctx.port ?? null,
        pairingCode: ctx.pairingCode ?? null,
      }
    },
  }),
  defineOp({
    name: 'ai.provider.list',
    version: 1,
    kind: 'query',
    summary: '列出 AI 供应商（不返回密钥）',
    input: z.object({}),
    exposure: { http: true, cli: ['ai', 'provider', 'list'], mcp: true, ai: false },
    aggregate: 'ai',
    handler: (ctx) => listProviders(ctx.db),
  }),
  defineOp({
    name: 'ai.provider.save',
    version: 1,
    kind: 'command',
    summary: '新增或更新 AI 供应商',
    input: SaveProviderInput,
    exposure: { http: true, cli: ['ai', 'provider', 'save'], mcp: true, ai: false },
    annotations: { idempotent: false },
    aggregate: 'ai',
    handler: (ctx, input) => saveProvider(ctx.db, input, ctx.dataDir),
  }),
  defineOp({
    name: 'ai.provider.delete',
    version: 1,
    kind: 'command',
    summary: '删除 AI 供应商',
    input: z.object({ id: Id }),
    exposure: { http: true, cli: ['ai', 'provider', 'delete'], mcp: true, ai: false },
    annotations: { destructive: true, confirm: true },
    aggregate: 'ai',
    handler: (ctx, input) => deleteProvider(ctx.db, input.id),
  }),
  defineOp({
    name: 'ai.provider.test',
    version: 1,
    kind: 'command',
    summary: '测试 AI 供应商连通性',
    input: TestProviderInput,
    exposure: { http: true, cli: ['ai', 'provider', 'test'], mcp: true, ai: false },
    annotations: { idempotent: true },
    aggregate: 'ai',
    handler: async (ctx, input): Promise<TestProviderResult> =>
      testProvider(ctx.db, ctx.dataDir, input.id),
  }),
  defineOp({
    name: 'ai.provider.get',
    version: 1,
    kind: 'query',
    summary: '读取 AI 供应商元数据',
    input: z.object({ id: Id }),
    exposure: { http: true, cli: false, mcp: false, ai: false },
    aggregate: 'ai',
    handler: (ctx, input) => {
      const row = getProviderRow(ctx.db, input.id)
      return {
        id: row.id,
        name: row.name,
        baseUrl: row.base_url,
        model: row.model,
        hasKey: Boolean(row.api_key_encrypted),
        isDefault: row.is_default === 1,
      } satisfies Partial<z.infer<typeof ProviderSchema>>
    },
  }),
]
