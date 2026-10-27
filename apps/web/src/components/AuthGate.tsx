import { useEffect, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { AuthScreen } from './AuthScreen'

export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const check = useAuthStore((s) => s.check)
  const markGuest = useAuthStore((s) => s.markGuest)
  const queryClient = useQueryClient()

  useEffect(() => {
    void check()
    const onUnauthorized = () => markGuest()
    window.addEventListener('daily:unauthorized', onUnauthorized)
    return () => window.removeEventListener('daily:unauthorized', onUnauthorized)
  }, [check, markGuest])

  useEffect(() => {
    queryClient.clear()
  }, [user?.id, queryClient])

  if (status === 'loading') {
    return (
      <div className="auth-splash">
        <img src="/logo.png" alt="时序" />
        <div>
          <b>时序</b>
          <span><Loader2 size={12} className="spin" /> 正在打开工作台…</span>
        </div>
      </div>
    )
  }
  if (status === 'guest') return <AuthScreen />
  return <>{children}</>
}
