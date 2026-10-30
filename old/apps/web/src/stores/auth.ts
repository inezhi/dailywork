import { create } from 'zustand'
import type { LoginInput, PublicUser, RegisterInput } from '@daily/contracts'
import { authApi } from '@/lib/auth-api'

type AuthStatus = 'loading' | 'guest' | 'authenticated'

interface AuthState {
  user: PublicUser | null
  status: AuthStatus
  check: () => Promise<void>
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: PublicUser) => void
  markGuest: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  check: async () => {
    set({ status: 'loading' })
    try {
      const { user } = await authApi.me()
      set({ user, status: 'authenticated' })
    } catch {
      set({ user: null, status: 'guest' })
    }
  },
  login: async (input) => {
    const { user } = await authApi.login(input)
    set({ user, status: 'authenticated' })
  },
  register: async (input) => {
    const { user } = await authApi.register(input)
    set({ user, status: 'authenticated' })
  },
  logout: async () => {
    try {
      await authApi.logout()
    } finally {
      set({ user: null, status: 'guest' })
    }
  },
  setUser: (user) => set({ user, status: 'authenticated' }),
  markGuest: () => set({ user: null, status: 'guest' }),
}))
