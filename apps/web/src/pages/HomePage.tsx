import { useQuery } from '@tanstack/react-query'
import { PixelButton, PixelCard } from '@cyber-universe/ui'
import { api } from '@cyber-universe/api-client'
import { useAuth } from '@/store/auth'

const QUICK_LINKS = [
  { to: '/world', label: '进入世界', desc: '走进像素小岛，和居民打招呼' },
  { to: '/residents', label: '居民', desc: '创造与管理 AI 居民' },
  { to: '/chat', label: '聊天', desc: '流式对话，居民会记住你' },
  { to: '/settings', label: '设置', desc: '模型配置与账户' },
] as const

/** 登录后的主页：概览 + 快捷入口。 */
export function HomePage() {
  const { user } = useAuth()
  const residents = useQuery({ queryKey: ['residents'], queryFn: () => api.residents.list() })
  const sessions = useQuery({ queryKey: ['chat-sessions'], queryFn: () => api.chat.listSessions() })
  const online = residents.data?.filter((r) => r.is_online).length ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-pixel text-sm text-wbrown">你好，{user?.nickname}</h1>
        <p className="mt-1 text-sm text-ink/60">
          你的小岛上有 {residents.data?.length ?? 0} 位居民（{online} 位在线），{sessions.data?.length ?? 0} 场对话正在进行。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_LINKS.map((l) => (
          <PixelCard key={l.to} className="flex flex-col gap-2">
            <p className="font-semibold text-ink">{l.label}</p>
            <p className="flex-1 text-xs text-ink/50">{l.desc}</p>
            <PixelButton to={l.to} variant="outline" className="min-h-[40px] text-sm">
              前往 →
            </PixelButton>
          </PixelCard>
        ))}
      </div>

      <PixelCard>
        <h2 className="font-pixel text-[10px] text-wbrown">下一步</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink/70">
          {residents.data?.length === 0 && <li>去「设置」添加模型配置，再创造第一位居民。</li>}
          {online === 0 && (residents.data?.length ?? 0) > 0 && <li>居民还没配模型配置，配置后 TA 就会上线。</li>}
          <li>进入世界，靠近居民按 E（或点「互动」）就能聊天。</li>
          <li>家庭、信箱、回忆、花园将在 M3/M4 开放。</li>
        </ul>
      </PixelCard>
    </div>
  )
}
