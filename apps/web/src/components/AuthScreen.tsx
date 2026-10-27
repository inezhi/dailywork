import { useEffect, useState } from 'react'
import { ArrowRight, Check, Loader2, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react'
import { authApi } from '@/lib/auth-api'
import { useAuthStore } from '@/stores/auth'

type Mode = 'login' | 'register'

export function AuthScreen() {
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)
  const [mode, setMode] = useState<Mode>('login')
  const [hasUsers, setHasUsers] = useState<boolean | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    authApi
      .status()
      .then((status) => {
        setHasUsers(status.hasUsers)
        if (!status.hasUsers) setMode('register')
      })
      .catch(() => setHasUsers(null))
  }, [])

  const switchMode = (next: Mode) => {
    setMode(next)
    setError('')
    setPassword('')
    setConfirm('')
  }

  const submit = async () => {
    setError('')
    if (!username.trim()) {
      setError('请输入用户名')
      return
    }
    if (password.length < 8) {
      setError('密码至少 8 位')
      return
    }
    if (mode === 'register' && password !== confirm) {
      setError('两次输入的密码不一致')
      return
    }
    setBusy(true)
    try {
      if (mode === 'login') await login({ username: username.trim(), password })
      else await register({ username: username.trim(), password })
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell">
      <aside className="auth-brand">
        <div className="auth-brand-top">
          <img src="/logo.png" alt="时序" className="auth-logo" />
          <div>
            <b>时序</b>
            <span>DAILYWORK</span>
          </div>
        </div>
        <div className="auth-brand-copy">
          <h1>时间有序，<br />专注有度。</h1>
          <p>把任务、时间、专注与知识放进同一个工作台。数据由你掌控，可随时导出。</p>
          <ul>
            <li><Check size={13} /> 今天先做一件重要的事</li>
            <li><Check size={13} /> 专注结束后自动记录投入</li>
            <li><Check size={13} /> 周复盘与仪表盘看见节奏</li>
          </ul>
        </div>
        <div className="auth-brand-foot">
          <ShieldCheck size={14} />
          <span>独立账户 · 可完整导出 · 不依赖第三方账号</span>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <img src="/logo.png" alt="" />
            <b>时序 · Dailywork</b>
          </div>
          <div className="auth-tabs" role="tablist" aria-label="登录或注册">
            <button
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'on' : ''}
              onClick={() => switchMode('login')}
            >
              登录
            </button>
            <button
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'on' : ''}
              onClick={() => switchMode('register')}
            >
              注册
            </button>
          </div>

          <div className="auth-heading">
            <h2>{mode === 'login' ? '欢迎回来' : hasUsers === false ? '创建账户' : '创建账户'}</h2>
            <p>
              {mode === 'login'
                ? '输入账户，继续今天的工作。'
                : hasUsers === false
                  ? '这是第一个账户；每个账户拥有独立的数据与设置。'
                  : '每个账户拥有独立的任务、文档与设置。'}
            </p>
          </div>

          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <label>
              <span>用户名</span>
              <div className="auth-input">
                <UserRound size={15} />
                <input
                  autoFocus
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="你的用户名"
                  autoComplete="username"
                  maxLength={32}
                />
              </div>
            </label>
            <label>
              <span>密码</span>
              <div className="auth-input">
                <LockKeyhole size={15} />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 8 位"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  maxLength={128}
                />
              </div>
            </label>
            {mode === 'register' && (
              <label>
                <span>确认密码</span>
                <div className="auth-input">
                  <LockKeyhole size={15} />
                  <input
                    type="password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    placeholder="再输入一次"
                    autoComplete="new-password"
                    maxLength={128}
                  />
                </div>
              </label>
            )}
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? (
                <><Loader2 size={15} className="spin" /> 处理中…</>
              ) : (
                <>{mode === 'login' ? '进入时序' : '创建并进入'} <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <div className="auth-switch">
            {mode === 'login' ? (
              <>第一次使用？<button onClick={() => switchMode('register')}>创建一个账户</button></>
            ) : (
              <>已经有账户？<button onClick={() => switchMode('login')}>直接登录</button></>
            )}
          </div>

          <div className="auth-note">
            默认头像使用用户名首字母生成；登录后可在「设置 → 账户」上传头像或修改密码。
          </div>
        </div>
      </main>
    </div>
  )
}
