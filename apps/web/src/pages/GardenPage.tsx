// © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PixelButton, PixelCard } from '@cyber-universe/ui'
import { api, ApiClientError, type GardenPlotOut } from '@cyber-universe/api-client'

function errorMessage(e: unknown): string {
  return e instanceof ApiClientError ? e.message : '网络异常，请稍后再试'
}

const CROPS = [
  { key: 'radish', label: '樱桃萝卜 · 90分钟' },
  { key: 'tomato', label: '小番茄 · 4小时' },
  { key: 'sunflower', label: '向日葵 · 10小时' },
] as const

function PlotCard({ plot }: { plot: GardenPlotOut }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const refresh = async () => {
    setError('')
    await queryClient.invalidateQueries({ queryKey: ['garden'] })
  }
  const act = useMutation({
    mutationFn: (fn: () => Promise<GardenPlotOut>) => fn(),
    onSuccess: refresh,
    onError: (e) => setError(errorMessage(e)),
  })

  return (
    <div className="flex flex-col rounded border-2 border-ink/10 bg-cream p-3">
      <div className="flex items-center justify-between">
        <span className="font-pixel text-[10px] text-ink/40">#{plot.index + 1}</span>
        <span className="text-[10px] text-ink/40">收获 ×{plot.harvests}</span>
      </div>
      <div className="my-3 flex h-16 items-center justify-center">
        {plot.stage === 'empty' && <span className="text-2xl text-ink/25">▦</span>}
        {plot.stage === 'growing' && (
          <span className="text-2xl" title={plot.crop_name ?? ''}>
            {plot.progress < 0.5 ? '🌱' : '🌿'}
          </span>
        )}
        {plot.stage === 'mature' && <span className="text-2xl">🌻</span>}
      </div>
      <p className="text-center text-xs font-semibold text-ink">
        {plot.crop_name ?? '空地'}
      </p>
      {plot.stage === 'growing' && (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded bg-cream-deep">
            <div className="h-full rounded bg-sage" style={{ width: `${plot.progress * 100}%` }} />
          </div>
          <p className="mt-1 text-center text-[10px] text-ink/50">
            还需 {Math.ceil((plot.remaining_minutes ?? 0) / 60)} 小时
          </p>
        </>
      )}
      <div className="mt-2 flex justify-center gap-1.5">
        {plot.stage === 'empty' &&
          CROPS.map((c) => (
            <PixelButton
              key={c.key}
              className="min-h-0 px-2 py-1 text-[10px]"
              title={c.label}
              onClick={() => act.mutate(() => api.garden.plant(plot.index, c.key))}
              disabled={act.isPending}
            >
              {c.key === 'radish' ? '萝卜' : c.key === 'tomato' ? '番茄' : '葵'}
            </PixelButton>
          ))}
        {plot.stage === 'growing' && (
          <PixelButton
            variant="outline"
            className="min-h-0 px-2 py-1 text-[10px]"
            onClick={() => act.mutate(() => api.garden.clear(plot.index))}
            disabled={act.isPending}
          >
            铲除
          </PixelButton>
        )}
        {plot.stage === 'mature' && (
          <PixelButton
            className="min-h-0 px-2 py-1 text-[10px]"
            onClick={() => act.mutate(() => api.garden.harvest(plot.index))}
            disabled={act.isPending}
          >
            收获
          </PixelButton>
        )}
      </div>
      {error && <p className="mt-1 text-center text-[10px] text-red-600">{error}</p>}
    </div>
  )
}

export function GardenPage() {
  const plotsQuery = useQuery({
    queryKey: ['garden'],
    queryFn: api.garden.list,
    refetchInterval: 30_000, // 生长推进靠世界时钟，半分钟刷一次足够
  })

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3">
      <PixelCard className="w-full">
        <h1 className="font-pixel text-sm text-wbrown">花园</h1>
        <p className="mt-1 text-xs text-ink/60">
          8 块地，与现实时间同步生长（1 秒 = 1 游戏分钟）。成熟后收获，铲除不记收获。
        </p>
      </PixelCard>
      {plotsQuery.isLoading ? (
        <PixelCard className="w-full">
          <p className="text-xs text-ink/60">加载中…</p>
        </PixelCard>
      ) : plotsQuery.isError ? (
        <PixelCard className="w-full">
          <p className="text-xs text-red-600">{errorMessage(plotsQuery.error)}</p>
        </PixelCard>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(plotsQuery.data ?? []).map((p) => (
            <PlotCard key={p.index} plot={p} />
          ))}
        </div>
      )}
    </div>
  )
}
