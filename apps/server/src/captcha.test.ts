import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { peekCaptchaCode } from '@daily/platform'
import { createApp } from './app.js'

let dataDir: string
let bundle: ReturnType<typeof createApp>

async function request(path: string, init: RequestInit = {}) {
  const res = await bundle.app.request(path, init)
  const text = await res.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text }
  }
  return { status: res.status, json, cookie: res.headers.get('set-cookie') }
}

async function captcha() {
  const result = await request('/api/auth/captcha')
  expect(result.status).toBe(200)
  const id = result.json.data.id as string
  const answer = peekCaptchaCode(id)
  expect(answer).toBeTruthy()
  return { id, answer: answer! }
}

beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'dailywork-captcha-'))
  bundle = createApp({ dataDir, captchaDisabled: false })
})

afterAll(() => {
  bundle.closeDb()
  rmSync(dataDir, { recursive: true, force: true })
})

describe('registration captcha and account validation', () => {
  it('requires a strong password, an email and a captcha', async () => {
    const weak = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'CaptchaOwner', email: 'captcha@example.com', password: 'short' }),
    })
    expect(weak.status).toBe(422)
    expect(weak.json.error.code).toBe('VALIDATION_ERROR')

    const lettersOnly = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'CaptchaOwner', email: 'captcha@example.com', password: 'abcdefgh' }),
    })
    expect(lettersOnly.status).toBe(422)
    expect(lettersOnly.json.error.message).toContain('字母和数字')

    const noCaptcha = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'CaptchaOwner',
        email: 'captcha@example.com',
        password: 'captcha-pass-123',
      }),
    })
    expect(noCaptcha.status).toBe(400)
    expect(noCaptcha.json.error.code).toBe('CAPTCHA_REQUIRED')

    const challenge = await captcha()
    const registered = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'CaptchaOwner',
        email: 'captcha@example.com',
        password: 'captcha-pass-123',
        captchaId: challenge.id,
        captchaAnswer: challenge.answer,
      }),
    })
    expect(registered.status).toBe(200)
    expect(registered.json.data.user.email).toBe('captcha@example.com')
  })

  it('rejects a duplicate email', async () => {
    const challenge = await captcha()
    const duplicate = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'AnotherOwner',
        email: 'CAPTCHA@example.com',
        password: 'another-pass-123',
        captchaId: challenge.id,
        captchaAnswer: challenge.answer,
      }),
    })
    expect(duplicate.status).toBe(409)
    expect(duplicate.json.error.message).toContain('邮箱')
  })
})

describe('login failure captcha', () => {
  it('requires a captcha after repeated failures and accepts it on success', async () => {
    const login = (body: unknown) =>
      request('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })

    const first = await login({ username: 'CaptchaOwner', password: 'wrong-pass-1' })
    const second = await login({ username: 'CaptchaOwner', password: 'wrong-pass-2' })
    const third = await login({ username: 'CaptchaOwner', password: 'wrong-pass-3' })
    expect(first.json.error.code).toBe('UNAUTHORIZED')
    expect(second.json.error.code).toBe('UNAUTHORIZED')
    expect(third.status).toBe(400)
    expect(third.json.error.code).toBe('CAPTCHA_REQUIRED')

    const challenge = await captcha()
    const success = await login({
      username: 'CaptchaOwner',
      password: 'captcha-pass-123',
      captchaId: challenge.id,
      captchaAnswer: challenge.answer,
    })
    expect(success.status).toBe(200)
    expect(success.cookie).toContain('daily_session=')
  })
})
