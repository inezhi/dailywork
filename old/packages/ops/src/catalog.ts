import type { OpDescriptorMeta } from '@daily/contracts'
import { opMeta, type AnyOpDefinition } from './core.js'
import { taskOps } from './task-ops.js'
import { workspaceOps, projectOps } from './workspace-ops.js'
import { planningOps, focusOps } from './planning-ops.js'
import { captureOps, documentOps } from './capture-ops.js'
import { systemOps } from './system-ops.js'
import { attachmentOps } from './attachment-ops.js'
import { createAiOps } from './assistant-ops.js'

const baseOps: AnyOpDefinition[] = [
  ...taskOps,
  ...workspaceOps,
  ...projectOps,
  ...planningOps,
  ...focusOps,
  ...captureOps,
  ...documentOps,
  ...attachmentOps,
  ...systemOps,
] as AnyOpDefinition[]

export const allOps: AnyOpDefinition[] = [...baseOps, ...createAiOps(() => allOps)]

const opIndex = new Map(allOps.map((op) => [op.name, op]))

export function getOp(name: string): AnyOpDefinition {
  const op = opIndex.get(name)
  if (!op) {
    const err = new Error(`未知操作：${name}`)
    ;(err as Error & { code?: string }).code = 'NOT_FOUND'
    throw err
  }
  return op
}

export function listOpsMeta(): OpDescriptorMeta[] {
  return allOps.map((op) => opMeta(op))
}

export function cliOps(): AnyOpDefinition[] {
  return allOps.filter((op) => Array.isArray(op.exposure.cli))
}

export function httpOps(): AnyOpDefinition[] {
  return allOps.filter((op) => op.exposure.http)
}
