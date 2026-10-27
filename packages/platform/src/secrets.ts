import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function loadOrCreateKey(dataDir: string): Buffer {
  const file = join(dataDir, 'secrets.key')
  if (existsSync(file)) {
    const raw = readFileSync(file)
    if (raw.length >= 32) return raw.subarray(0, 32)
  }
  const key = randomBytes(32)
  writeFileSync(file, key, { mode: 0o600 })
  return key
}

export function encryptSecret(dataDir: string, plaintext: string): string {
  const key = loadOrCreateKey(dataDir)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
}

export function decryptSecret(dataDir: string, payload: string | null): string | null {
  if (!payload) return null
  const parts = payload.split(':')
  if (parts.length !== 4 || parts[0] !== 'v1') return null
  try {
    const key = loadOrCreateKey(dataDir)
    const iv = Buffer.from(parts[1]!, 'base64')
    const tag = Buffer.from(parts[2]!, 'base64')
    const data = Buffer.from(parts[3]!, 'base64')
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

export function maskSecret(value: string): string {
  if (value.length <= 8) return '••••••••'
  return `${value.slice(0, 3)}••••${value.slice(-4)}`
}
