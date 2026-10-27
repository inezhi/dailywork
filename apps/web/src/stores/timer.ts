import { create } from 'zustand'
import type { FocusSession } from '@daily/contracts'
import { callOp } from '@/lib/api'
import { toast } from './toast'

interface TimerState {
  session: FocusSession | null
  remainingSeconds: number
  totalSeconds: number
  initialized: boolean
  starting: boolean
  init: () => Promise<void>
  start: (minutes: number, taskId?: string | null) => Promise<void>
  finish: () => Promise<void>
  cancel: () => Promise<void>
}

let interval: ReturnType<typeof setInterval> | null = null

function computeRemaining(session: FocusSession): number {
  const elapsed = (Date.now() - Date.parse(session.startedAt)) / 1000
  return Math.max(0, Math.round(session.plannedMinutes * 60 - elapsed))
}

export const useTimer = create<TimerState>((set, get) => ({
  session: null,
  remainingSeconds: 0,
  totalSeconds: 0,
  initialized: false,
  starting: false,
  init: async () => {
    if (get().initialized) return
    set({ initialized: true })
    try {
      const session = await callOp<FocusSession | null>('focus.active')
      if (session) {
        set({
          session,
          remainingSeconds: computeRemaining(session),
          totalSeconds: session.plannedMinutes * 60,
        })
      }
    } catch {
      // Server may not be ready yet; the next start will surface the error.
    }
    if (interval) clearInterval(interval)
    interval = setInterval(() => {
      const { session } = get()
      if (!session) return
      set({ remainingSeconds: computeRemaining(session) })
    }, 1000)
  },
  start: async (minutes, taskId) => {
    set({ starting: true })
    try {
      const session = await callOp<FocusSession>('focus.start', {
        minutes,
        taskId: taskId ?? null,
      })
      set({
        session,
        remainingSeconds: minutes * 60,
        totalSeconds: minutes * 60,
        starting: false,
      })
      toast.success(`开始 ${minutes} 分钟专注`)
    } catch (error) {
      set({ starting: false })
      const message = error instanceof Error ? error.message : '无法开始专注'
      toast.error(message)
      // If a session already exists, load it so the UI can recover.
      try {
        const active = await callOp<FocusSession | null>('focus.active')
        if (active) {
          set({
            session: active,
            remainingSeconds: computeRemaining(active),
            totalSeconds: active.plannedMinutes * 60,
          })
        }
      } catch {
        // ignore
      }
      throw error
    }
  },
  finish: async () => {
    const { session } = get()
    if (!session) return
    try {
      await callOp<FocusSession>('focus.finish', { id: session.id })
      const minutes = Math.max(1, Math.round((Date.now() - Date.parse(session.startedAt)) / 60000))
      toast.success(`专注完成，记录 ${minutes} 分钟`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '无法结束专注')
    }
    set({ session: null, remainingSeconds: 0, totalSeconds: 0 })
  },
  cancel: async () => {
    const { session } = get()
    if (!session) return
    try {
      await callOp<FocusSession>('focus.cancel', { id: session.id })
      toast.info('已取消本次专注')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '无法取消专注')
    }
    set({ session: null, remainingSeconds: 0, totalSeconds: 0 })
  },
}))
