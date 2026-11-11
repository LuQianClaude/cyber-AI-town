import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@cyber-universe/api-client'
import { createGame, type GameHandle, type NpcConfig } from '@cyber-universe/game-engine'
import { useAuth } from '@/store/auth'

const PLAYER_CONFIG = {
  hair: '#26262C',
  hairShade: '#17171B',
  eyes: '#4A3B2F',
  outfit: '#F3E9DC',
  outfitShade: '#DCCDB8',
  longHair: true,
}

type Phase = 'loading' | 'ready' | 'error'

/**
 * M2 像素世界：登录后把 AI 居民放进世界（广场待命），
 * 靠近按 E 或点击居民即可跳转聊天。
 */
export function WorldPage() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [toast, setToast] = useState('')
  const handleRef = useRef<GameHandle | null>(null)
  const navigate = useNavigate()
  const { user } = useAuth()
  const residents = useQuery({
    queryKey: ['residents'],
    queryFn: () => api.residents.list(),
    enabled: !!user,
    retry: 1,
  })

  // M4 主动行为：进入世界时物化「该主动做的事」（来信 / 打招呼），静默失败
  useEffect(() => {
    if (!user) return
    api.proactive.run().catch(() => undefined)
  }, [user])

  useEffect(() => {
    if (!user) return
    const host = hostRef.current
    if (!host) return
    const npcs: NpcConfig[] = (residents.data ?? []).map((r) => ({
      id: r.id,
      nickname: r.nickname,
      colors: {
        hair: r.avatar.hair,
        hairShade: r.avatar.hairShade,
        eyes: r.avatar.eyes,
        outfit: r.avatar.outfit,
        outfitShade: r.avatar.outfitShade,
        skin: r.avatar.skin,
      },
      longHair: r.avatar.longHair,
    }))
    try {
      const handle = createGame({
        parent: host,
        player: PLAYER_CONFIG,
        npcs,
        onNpcInteract: (npcId) => navigate(`/chat?with=${npcId}`),
        debug: import.meta.env.DEV,
        onReady: () => setPhase('ready'),
        onStatus: (msg) => {
          if (msg === '世界已就绪') return
          setToast(msg)
        },
      })
      handleRef.current = handle
      return () => {
        handleRef.current = null
        handle.destroy()
      }
    } catch (e) {
      console.error('[world] 引擎启动失败', e)
      setPhase('error')
    }
    // residents.data 稳定后再重建世界（居民增减时刷新 NPC）
  }, [user, residents.data, navigate])

  if (!user) {
    return (
      <div className="fixed inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
        <p className="font-pixel text-xs text-wbrown">世界需要你登录</p>
        <p className="max-w-sm text-sm text-ink/60">登录后你的 AI 居民会在这里等你。</p>
        <Link
          to="/login"
          className="rounded border-2 border-wbrown bg-wbrown px-4 py-2 text-sm font-semibold text-cream"
        >
          去登录
        </Link>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-cream" data-testid="world-page">
      <div ref={hostRef} className="absolute inset-0" aria-label="像素世界" />

      {/* 顶部 HUD */}
      <div className="pointer-events-none absolute left-0 top-0 z-10 flex w-full items-center gap-3 p-3">
        <Link
          to="/home"
          className="pointer-events-auto rounded border-2 border-wbrown/40 bg-cream px-3 py-2 text-sm font-semibold text-wbrown transition-colors hover:bg-cream-deep"
        >
          ← 主页
        </Link>
        <span className="rounded bg-cream/85 px-2 py-1 font-pixel text-[9px] text-wbrown">
          CYBER UNIVERSE · 世界
        </span>
      </div>

      {/* 操作提示（触屏） */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 rounded bg-ink/70 px-3 py-1.5 text-xs font-semibold text-cream [@(pointer:coarse)]:block">
        左半屏拖动摇杆移动 · 靠近居民按「互动」聊天
      </div>

      {/* 加载态 */}
      {phase === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-cream">
          <p className="font-pixel text-xs text-wbrown">CYBER UNIVERSE</p>
          <p className="text-sm text-ink/60">正在生成小岛…</p>
          <div className="h-2 w-40 overflow-hidden rounded bg-cream-deep">
            <div className="h-full w-1/2 animate-pulse rounded bg-sage" />
          </div>
        </div>
      )}

      {/* 错误态 */}
      {phase === 'error' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
          <p className="font-pixel text-xs text-pink-dark">世界启动失败</p>
          <p className="max-w-sm text-sm text-ink/60">
            你的浏览器可能不支持 Canvas/WebGL。请尝试最新版 Chrome / Edge / Safari。
          </p>
          <Link to="/" className="rounded border-2 border-wbrown bg-wbrown px-4 py-2 text-sm font-semibold text-cream">
            返回首页
          </Link>
        </div>
      )}

      {/* 引擎状态浮层 */}
      {toast && phase === 'ready' && (
        <div className="pointer-events-none absolute left-1/2 top-14 z-10 -translate-x-1/2 rounded bg-wbrown px-3 py-1.5 text-xs font-semibold text-cream">
          {toast}
        </div>
      )}
    </div>
  )
}
