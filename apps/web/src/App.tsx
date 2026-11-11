// © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { RequireAuth } from '@/components/RequireAuth'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { useAuth } from '@/store/auth'

/** 像素世界（Phaser）按需加载，避免 phaser 进入首屏包 */
const WorldPage = lazy(() =>
  import('@/pages/WorldPage').then((m) => ({ default: m.WorldPage })),
)
const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })))
const ResidentsPage = lazy(() =>
  import('@/pages/ResidentsPage').then((m) => ({ default: m.ResidentsPage })),
)
const ChatPage = lazy(() => import('@/pages/ChatPage').then((m) => ({ default: m.ChatPage })))
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const FamilyPage = lazy(() => import('@/pages/FamilyPage').then((m) => ({ default: m.FamilyPage })))
const MailboxPage = lazy(() => import('@/pages/MailboxPage').then((m) => ({ default: m.MailboxPage })))
const GardenPage = lazy(() => import('@/pages/GardenPage').then((m) => ({ default: m.GardenPage })))
const CalendarPage = lazy(() => import('@/pages/CalendarPage').then((m) => ({ default: m.CalendarPage })))

function withAuth(children: ReactNode) {
  return <RequireAuth>{children}</RequireAuth>
}

/** 待实现里程碑的占位页（真实空状态，不伪造功能）。 */
const futureRoutes = [
  { path: '/memories', title: '回忆', milestone: 'M4' },
  { path: '/town', title: '小镇', milestone: 'M1' },
] as const

const lazyFallback = (
  <div className="flex min-h-screen items-center justify-center bg-cream">
    <p className="font-pixel text-xs text-wbrown">加载中…</p>
  </div>
)

export default function App() {
  // 启动时恢复登录态（刷新令牌若有效则直接回到登录状态）
  const bootstrap = useAuth((s) => s.bootstrap)
  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/world"
        element={
          <Suspense fallback={lazyFallback}>
            <WorldPage />
          </Suspense>
        }
      />
      <Route path="/home" element={withAuth(<AppShell><HomePage /></AppShell>)} />
      <Route path="/residents" element={withAuth(<AppShell><ResidentsPage /></AppShell>)} />
      <Route path="/chat" element={withAuth(<AppShell><ChatPage /></AppShell>)} />
      <Route path="/settings" element={withAuth(<AppShell><SettingsPage /></AppShell>)} />
      <Route path="/family" element={withAuth(<AppShell><FamilyPage /></AppShell>)} />
      <Route path="/mailbox" element={withAuth(<AppShell><MailboxPage /></AppShell>)} />
      <Route path="/garden" element={withAuth(<AppShell><GardenPage /></AppShell>)} />
      <Route path="/diary" element={withAuth(<AppShell><CalendarPage /></AppShell>)} />
      {futureRoutes.map((r) => (
        <Route
          key={r.path}
          path={r.path}
          element={
            <AppShell>
              <PlaceholderPage title={r.title} milestone={r.milestone} />
            </AppShell>
          }
        />
      ))}
      <Route
        path="*"
        element={
          <AppShell>
            <PlaceholderPage title="页面不存在" milestone="——" />
          </AppShell>
        }
      />
    </Routes>
  )
}
