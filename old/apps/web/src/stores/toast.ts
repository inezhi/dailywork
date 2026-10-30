import { create } from 'zustand'

export type ToastTone = 'info' | 'success' | 'error'
export interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

interface ToastState {
  items: ToastItem[]
  push: (message: string, tone?: ToastTone) => void
  dismiss: (id: number) => void
}

let counter = 0

export const useToasts = create<ToastState>((set) => ({
  items: [],
  push: (message, tone = 'info') => {
    const id = ++counter
    set((state) => ({ items: [...state.items, { id, message, tone }] }))
    setTimeout(() => {
      set((state) => ({ items: state.items.filter((t) => t.id !== id) }))
    }, tone === 'error' ? 5200 : 2800)
  },
  dismiss: (id) => set((state) => ({ items: state.items.filter((t) => t.id !== id) })),
}))

export const toast = {
  info: (message: string) => useToasts.getState().push(message, 'info'),
  success: (message: string) => useToasts.getState().push(message, 'success'),
  error: (message: string) => useToasts.getState().push(message, 'error'),
}
