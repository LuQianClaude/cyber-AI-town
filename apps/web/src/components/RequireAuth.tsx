import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/store/auth'

/** 登录守卫：未登录跳转登录页，登录后回跳来源地址。 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready, bootstrap } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (!ready) void bootstrap()
  }, [ready, bootstrap])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="font-pixel text-xs text-wbrown">CYBER UNIVERSE</p>
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return <>{children}</>
}
