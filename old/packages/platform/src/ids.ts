import { randomBytes } from 'node:crypto'

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'

function randomPart(bytes: number): string {
  const buf = randomBytes(bytes)
  let out = ''
  for (const b of buf) out += ALPHABET[b & 31]
  return out
}

export function newId(prefix: string): string {
  return `${prefix}_${randomPart(8)}${randomPart(8)}`
}

export function newOpId(): string {
  return `op_${randomPart(10)}${randomPart(6)}`
}

export const ID_PREFIX = {
  space: 'spc',
  project: 'prj',
  task: 'tsk',
  tag: 'tag',
  memo: 'mem',
  document: 'doc',
  focus: 'foc',
  deliverable: 'dlv',
  template: 'tpl',
  attachment: 'att',
  blob: 'blb',
  provider: 'prv',
  conversation: 'cnv',
  message: 'msg',
  routine: 'rtn',
} as const
