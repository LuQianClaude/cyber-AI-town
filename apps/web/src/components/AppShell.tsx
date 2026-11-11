import { Suspense, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { PixelButton } from '@cyber-universe/ui'
import { ApiStatus } from '@/components/ApiStatus'
import { useAuth } from '@/store/auth'

const navItems = [
  { to: '/world', label: '世界' },
  { to: '/family', label: '家庭' },
  { to: '/residents', label: '居民' },
  { to: '/chat', label: '聊天' },
  { to: '/mailbox', label: '信箱' },
  { to: '/memories', label: '回忆' },
  { to: '/garden', label: '花园' },
  { to: '/town', label: '小镇' },
  { to: '/settings', label: '设置' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b-2 border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" className="font-pixel text-xs text-wbrown">
            CYBER&nbsp;UNIVERSE
          </Link>
          <nav className="hidden gap-1 md:flex" aria-label="主导航">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'rounded px-3 py-2 text-sm font-semibold transition-colors',
                    isActive ? 'bg-sage/30 text-sage-dark' : 'text-ink/60 hover:bg-cream-deep hover:text-ink',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <ApiStatus />
            {user ? (
              <>
                <Link to="/home" className="text-sm font-semibold text-ink/70 hover:text-ink">
                  {user.nickname}
                </Link>
                <PixelButton
                  variant="outline"
                  className="min-h-[36px] px-3 py-1 text-sm"
                  onClick={() => void logout()}
                >
                  退出
                </PixelButton>
              </>
            ) : (
              <PixelButton to="/login" variant="outline">
                登录
              </PixelButton>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Suspense
          fallback={
            <div className="flex min-h-[40vh] items-center justify-center">
              <p className="font-pixel text-xs text-wbrown">加载中…</p>
            </div>
          }
        >
          {children}
        </Suspense>
      </main>
      <footer className="border-t-2 border-ink/10 py-4 text-center text-xs text-ink/50">
        Cyber Universe · M0 工程初始化完成 · 世界将在 M1 苏醒
      </footer>
    </div>
  )
}
