import type { ChangePasswordInput, LoginInput, PublicUser, RegisterInput } from '@daily/contracts'

export interface CaptchaChallenge {
  id: string
  image: string
  expiresInSeconds: number
}

export type CaptchaResponse = CaptchaChallenge | { disabled: true }
import { ApiError } from './api'

async function authRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, { credentials: 'same-origin', ...init })
  } catch (error) {
    throw new ApiError('NETWORK', error instanceof Error ? error.message : '无法连接服务')
  }
  let body: { ok?: boolean; data?: T; error?: { code?: string; message?: string } }
  try {
    body = (await res.json()) as typeof body
  } catch {
    throw new ApiError('BAD_RESPONSE', `服务返回了无法解析的响应（HTTP ${res.status}）`)
  }
  if (!res.ok || !body.ok) {
    throw new ApiError(body.error?.code ?? 'INTERNAL', body.error?.message ?? `请求失败（HTTP ${res.status}）`)
  }
  return body.data as T
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export const authApi = {
  status: () => authRequest<{ hasUsers: boolean; captchaEnabled: boolean }>('/api/auth/status'),
  captcha: () => authRequest<CaptchaResponse>('/api/auth/captcha'),
  me: () => authRequest<{ user: PublicUser }>('/api/auth/me'),
  register: (input: RegisterInput) =>
    authRequest<{ user: PublicUser }>('/api/auth/register', json(input)),
  login: (input: LoginInput) => authRequest<{ user: PublicUser }>('/api/auth/login', json(input)),
  logout: () => authRequest<{ loggedOut: boolean }>('/api/auth/logout', { method: 'POST' }),
  changePassword: (input: ChangePasswordInput) =>
    authRequest<{ changed: boolean }>('/api/auth/password', json(input)),
  uploadAvatar: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return authRequest<{ user: PublicUser }>('/api/auth/avatar', { method: 'POST', body: form })
  },
  deleteAvatar: () => authRequest<{ user: PublicUser }>('/api/auth/avatar', { method: 'DELETE' }),
}
