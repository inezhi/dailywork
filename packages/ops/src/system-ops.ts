import { z } from 'zod'
import {
  OpError,
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
import { execFileSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
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
        schemaVersion: 3,
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
      const httpUrls: string[] = []
      const httpsUrls: string[] = []
      if (settings.general.lanEnabled && ctx.port) {
        for (const list of Object.values(networkInterfaces())) {
          for (const info of list ?? []) {
            if (info.family === 'IPv4' && !info.internal) {
              httpUrls.push(`http://${info.address}:${ctx.port}`)
              if (ctx.httpsPort) httpsUrls.push(`https://${info.address}:${ctx.httpsPort}`)
            }
          }
        }
      }
      return {
        enabled: settings.general.lanEnabled,
        urls: ctx.httpsPort ? httpsUrls : httpUrls,
        httpUrls,
        httpsUrls,
        secure: Boolean(ctx.httpsPort),
        port: ctx.port ?? null,
        httpsPort: ctx.httpsPort ?? null,
        pairingCode: ctx.pairingCode ?? null,
      }
    },
  }),
  defineOp({
    name: 'lan.setupHttps',
    version: 1,
    kind: 'command',
    summary: '生成局域网 HTTPS 自签名证书（重启后启用）',
    input: z.object({}),
    exposure: { http: true, cli: ['lan', 'setup-https'], mcp: false, ai: false },
    annotations: { idempotent: false },
    aggregate: 'system',
    handler: (ctx) => {
      const ips = new Set<string>(['127.0.0.1'])
      for (const list of Object.values(networkInterfaces())) {
        for (const info of list ?? []) {
          if (info.family === 'IPv4' && !info.internal) ips.add(info.address)
        }
      }
      const certDir = join(ctx.dataDir, 'certs')
      mkdirSync(certDir, { recursive: true, mode: 0o700 })
      const certFile = join(certDir, 'server.crt')
      const keyFile = join(certDir, 'server.key')
      const alreadyExisted = existsSync(certFile) && existsSync(keyFile)
      const san = ['DNS:localhost', ...Array.from(ips).map((ip) => `IP:${ip}`)].join(',')
      const openssl = process.env.OPENSSL_BIN ?? 'openssl'
      try {
        execFileSync(openssl, [
          'req',
          '-x509',
          '-newkey',
          'rsa:2048',
          '-sha256',
          '-days',
          '825',
          '-nodes',
          '-keyout',
          keyFile,
          '-out',
          certFile,
          '-subj',
          '/CN=Dailywork Local',
          '-addext',
          `subjectAltName=${san}`,
          '-addext',
          'basicConstraints=critical,CA:TRUE',
          '-addext',
          'keyUsage=critical,keyCertSign,digitalSignature,keyEncipherment',
        ])
      } catch (error) {
        throw new OpError(
          'UNSUPPORTED',
          `无法生成证书。请确认 openssl 可用，或运行 pnpm lan:https。${error instanceof Error ? `（${error.message.slice(0, 120)}）` : ''}`,
        )
      }
      copyFileSync(certFile, join(certDir, 'dailywork-ca.crt'))
      chmodSync(keyFile, 0o600)
      chmodSync(certFile, 0o600)
      chmodSync(join(certDir, 'dailywork-ca.crt'), 0o600)
      return {
        certPath: certFile,
        caPath: join(certDir, 'dailywork-ca.crt'),
        ips: Array.from(ips),
        restartRequired: true,
        alreadyExisted,
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
