import { randomBytes, randomInt } from 'node:crypto'

interface CaptchaEntry {
  code: string
  expiresAt: number
  attempts: number
}

export interface CaptchaChallenge {
  id: string
  image: string
  expiresInSeconds: number
}

const TTL_MS = 5 * 60_000
const MAX_ATTEMPTS = 5
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CAPTCHAS = new Map<string, CaptchaEntry>()

function randomCode(): string {
  return Array.from({ length: 4 }, () => ALPHABET[randomInt(0, ALPHABET.length)]).join('')
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (ch) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&apos;',
    }
    return entities[ch] ?? ch
  })
}

function renderSvg(code: string): string {
  const colors = ['#0958d9', '#1677ff', '#13c2c2', '#1d2129']
  const chars = [...code]
    .map((char, index) => {
      const x = 18 + index * 28
      const y = 30 + randomInt(-3, 4)
      const rotate = randomInt(-18, 19)
      return `<text x="${x}" y="${y}" fill="${colors[index % colors.length]}" font-family="Inter, PingFang SC, sans-serif" font-size="25" font-weight="700" transform="rotate(${rotate} ${x} ${y})">${escapeXml(char)}</text>`
    })
    .join('')
  const lines = Array.from({ length: 4 }, () => {
    const x1 = randomInt(0, 132)
    const y1 = randomInt(4, 40)
    const x2 = randomInt(0, 132)
    const y2 = randomInt(4, 40)
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#b7c6df" stroke-width="1" opacity=".75"/>`
  }).join('')
  const dots = Array.from({ length: 22 }, () => {
    return `<circle cx="${randomInt(2, 136)}" cy="${randomInt(2, 42)}" r="${randomInt(1, 2)}" fill="#8aa4c8" opacity=".55"/>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="44" viewBox="0 0 140 44" role="img" aria-label="验证码"><rect width="140" height="44" rx="7" fill="#f0f5ff"/><path d="M0 35 Q35 18 70 32 T140 24" fill="none" stroke="#d6e4ff" stroke-width="2"/>${dots}${lines}${chars}</svg>`
}

export function createCaptcha(): CaptchaChallenge {
  const now = Date.now()
  for (const [id, entry] of CAPTCHAS) {
    if (entry.expiresAt <= now) CAPTCHAS.delete(id)
  }
  const id = randomBytes(18).toString('base64url')
  const code = randomCode()
  CAPTCHAS.set(id, { code, expiresAt: now + TTL_MS, attempts: 0 })
  return {
    id,
    image: `data:image/svg+xml;base64,${Buffer.from(renderSvg(code)).toString('base64')}`,
    expiresInSeconds: Math.round(TTL_MS / 1000),
  }
}

export function verifyCaptcha(
  id: string | undefined,
  answer: string | undefined,
): { ok: boolean; reason?: string } {
  if (!id || !answer) return { ok: false, reason: '请输入验证码' }
  const entry = CAPTCHAS.get(id)
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) CAPTCHAS.delete(id)
    return { ok: false, reason: '验证码已过期，请刷新' }
  }
  entry.attempts += 1
  if (entry.attempts > MAX_ATTEMPTS) {
    CAPTCHAS.delete(id)
    return { ok: false, reason: '验证码尝试次数过多，请刷新' }
  }
  if (answer.trim().toUpperCase() !== entry.code) {
    return { ok: false, reason: '验证码不正确' }
  }
  CAPTCHAS.delete(id)
  return { ok: true }
}

/** Test helper; never expose this through an HTTP route. */
export function peekCaptchaCode(id: string): string | null {
  return CAPTCHAS.get(id)?.code ?? null
}
