import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  Check,
  Loader2,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { ApiError } from '@/lib/api'
import { authApi, type CaptchaChallenge } from '@/lib/auth-api'
import { useAuthStore } from '@/stores/auth'

type Mode = 'login' | 'register'

function passwordProblem(value: string, forRegister: boolean): string {
  if (!value) return '请输入密码'
  if (!forRegister) return ''
  if (value.length < 8) return '密码至少 8 位'
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return '密码需同时包含字母和数字'
  return ''
}

function emailProblem(value: string): string {
  if (!value.trim()) return '请输入邮箱'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return '请输入有效的邮箱地址'
  return ''
}

export function AuthScreen() {
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)
  const [mode, setMode] = useState<Mode>('login')
  const [captchaEnabled, setCaptchaEnabled] = useState(false)
  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null)
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true)
    try {
      const result = await authApi.captcha()
      if ('disabled' in result) {
        setCaptchaEnabled(false)
        setCaptcha(null)
      } else {
        setCaptcha(result)
      }
    } catch {
      setCaptcha(null)
    } finally {
      setCaptchaLoading(false)
    }
  }, [])

  useEffect(() => {
    authApi
      .status()
      .then((status) => {
        setCaptchaEnabled(status.captchaEnabled)
        if (!status.hasUsers) {
          setMode('register')
          if (status.captchaEnabled) void loadCaptcha()
        }
      })
      .catch(() => {})
  }, [loadCaptcha])

  const switchMode = (next: Mode) => {
    setMode(next)
    setError('')
    setPassword('')
    setConfirm('')
    setCaptchaAnswer('')
    setCaptchaRequired(false)
    if (next === 'register' && captchaEnabled) void loadCaptcha()
    if (next === 'login') setCaptcha(null)
  }

  const submit = async () => {
    setError('')
    if (!username.trim()) {
      setError('请输入用户名')
      return
    }
    const passwordError = passwordProblem(password, mode === 'register')
    if (passwordError) {
      setError(passwordError)
      return
    }
    if (mode === 'register') {
      const mailError = emailProblem(email)
      if (mailError) {
        setError(mailError)
        return
      }
      if (password !== confirm) {
        setError('两次输入的密码不一致')
        return
      }
    }
    const needsCaptcha = mode === 'register' ? captchaEnabled || captchaRequired : captchaRequired
    if (needsCaptcha && !captchaAnswer.trim()) {
      setError('请输入验证码')
      return
    }
    setBusy(true)
    try {
      const captchaInput = needsCaptcha
        ? { captchaId: captcha?.id, captchaAnswer: captchaAnswer.trim() }
        : {}
      if (mode === 'login') {
        await login({ username: username.trim(), password, ...captchaInput })
      } else {
        await register({
          username: username.trim(),
          email: email.trim(),
          password,
          ...captchaInput,
        })
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CAPTCHA_REQUIRED') {
        setCaptchaRequired(true)
        await loadCaptcha()
        setCaptchaAnswer('')
      }
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  const showCaptcha = mode === 'register' ? captchaEnabled || captchaRequired : captchaRequired

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
            <h2>{mode === 'login' ? '欢迎回来' : '创建账户'}</h2>
            <p>{mode === 'login' ? '输入账户，继续今天的工作。' : '填写账户信息，开始使用。'}</p>
          </div>

          <form
            className="auth-form"
            noValidate
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
                  onChange={(event) => {
                    setUsername(event.target.value)
                    setError('')
                  }}
                  placeholder="你的用户名"
                  autoComplete="username"
                  maxLength={32}
                />
              </div>
            </label>
            {mode === 'register' && (
              <label>
                <span>邮箱</span>
                <div className={`auth-input${error.includes('邮箱') ? ' is-invalid' : ''}`}>
                  <Mail size={15} />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      setError('')
                    }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    maxLength={254}
                  />
                </div>
              </label>
            )}
            <label>
              <span>密码</span>
              <div className={`auth-input${error.includes('密码') ? ' is-invalid' : ''}`}>
                <LockKeyhole size={15} />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setError('')
                  }}
                  placeholder={mode === 'login' ? '请输入密码' : '至少 8 位，含字母和数字'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  maxLength={128}
                />
              </div>
              {mode === 'register' && (
                <span className="auth-hint">密码至少 8 位，需同时包含字母和数字。</span>
              )}
            </label>
            {mode === 'register' && (
              <label>
                <span>确认密码</span>
                <div className="auth-input">
                  <LockKeyhole size={15} />
                  <input
                    type="password"
                    value={confirm}
                    onChange={(event) => {
                      setConfirm(event.target.value)
                      setError('')
                    }}
                    placeholder="再输入一次"
                    autoComplete="new-password"
                    maxLength={128}
                  />
                </div>
              </label>
            )}
            {showCaptcha && (
              <div className="auth-captcha">
                <div className="auth-captcha-head">
                  <span>验证码</span>
                  <button type="button" onClick={() => void loadCaptcha()} disabled={captchaLoading}>
                    <RefreshCw size={11} className={captchaLoading ? 'spin' : ''} /> 换一张
                  </button>
                </div>
                <div className="auth-captcha-row">
                  <div className="auth-captcha-image" aria-live="polite">
                    {captcha ? <img src={captcha.image} alt="验证码图片" /> : <span>{captchaLoading ? '加载中…' : '点击刷新'}</span>}
                  </div>
                  <input
                    className="auth-captcha-input"
                    value={captchaAnswer}
                    onChange={(event) => {
                      setCaptchaAnswer(event.target.value.toUpperCase())
                      setError('')
                    }}
                    placeholder="输入图中字符"
                    autoComplete="off"
                    maxLength={8}
                  />
                </div>
              </div>
            )}
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="auth-submit" type="submit" disabled={busy || (showCaptcha && !captcha)}>
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
        </div>
      </main>
    </div>
  )
}
