import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PixelButton, PixelCard, PixelInput } from '@cyber-universe/ui'
import { api, ApiClientError } from '@cyber-universe/api-client'
import { useAuth } from '@/store/auth'

type Mode = 'login' | 'register'

/** M2 真实认证：注册 / 登录共用一页，成功后写入令牌并跳转。 */
export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const applyTokens = useAuth((s) => s.applyTokens)
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (mode === 'register' && password.length < 8) {
      setError('密码至少需要 8 位')
      return
    }
    setBusy(true)
    try {
      const tokens =
        mode === 'login'
          ? await api.auth.login({ email, password })
          : await api.auth.register({ email, password, nickname: nickname || undefined })
      applyTokens(tokens)
      navigate(location.state?.from ?? '/home', { replace: true })
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '网络异常，请稍后再试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-12">
      <PixelCard className="w-full max-w-sm">
        <div className="flex items-center justify-between">
          <h1 className="font-pixel text-sm text-wbrown">CYBER UNIVERSE</h1>
          <Link to="/" className="text-xs font-semibold text-ink/50 hover:text-ink">
            ← 首页
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-cream-deep p-1" role="tablist">
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m)
                setError('')
              }}
              className={[
                'rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                mode === m ? 'bg-cream text-wbrown shadow-sm' : 'text-ink/50 hover:text-ink',
              ].join(' ')}
            >
              {m === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        <form className="mt-5 flex flex-col gap-4" onSubmit={onSubmit}>
          {mode === 'register' && (
            <PixelInput
              label="昵称"
              name="nickname"
              placeholder="你在宇宙里的名字"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={50}
            />
          )}
          <PixelInput
            label="邮箱"
            type="email"
            name="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <PixelInput
            label="密码"
            type="password"
            name="password"
            placeholder={mode === 'register' ? '至少 8 位' : '••••••••'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          {error && (
            <p role="alert" className="rounded border-2 border-pink-dark/40 bg-pink/20 px-3 py-2 text-sm text-pink-dark">
              {error}
            </p>
          )}

          <PixelButton type="submit" disabled={busy}>
            {busy ? '请稍候…' : mode === 'login' ? '登录' : '创建账户'}
          </PixelButton>
        </form>

        <p className="mt-4 text-center text-xs text-ink/40">
          注册即表示同意在本地宇宙中与 AI 居民共同生活
        </p>
      </PixelCard>
    </div>
  )
}
