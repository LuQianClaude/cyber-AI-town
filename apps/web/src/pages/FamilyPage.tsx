// © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PixelButton, PixelCard } from '@cyber-universe/ui'
import {
  api,
  ApiClientError,
  type FamilyTreeOut,
  type RelationshipItem,
  type RelationType,
  type ResidentOut,
} from '@cyber-universe/api-client'
import { renderCharacterDataURL } from '@cyber-universe/game-engine'
const TYPE_LABEL: Record<RelationType, string> = {
  spouse: '结婚',
  sworn: '结拜',
  neighbor: '邻居',
}

const TYPE_ORDER: RelationType[] = ['spouse', 'sworn', 'neighbor']

const STATUS_LABEL: Record<string, string> = {
  pending: '待确认',
  accepted: '生效中',
}

const TRIGGER_LABEL: Record<string, string> = {
  first: '第一篇',
  new_day: '新的一天',
  mood_swing: '心情波动',
}

function DiarySection({ residentId, residents }: { residentId: string; residents: ResidentOut[] }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const resident = residents.find((r) => r.id === residentId)
  const diaryQuery = useQuery({
    queryKey: ['diary', residentId],
    queryFn: () => api.diary.list(residentId),
  })
  const write = useMutation({
    mutationFn: () => api.diary.write(residentId),
    onSuccess: async () => {
      setError('')
      await queryClient.invalidateQueries({ queryKey: ['diary', residentId] })
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const entries = diaryQuery.data ?? []
  return (
    <PixelCard className="w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-pixel text-xs text-wbrown">{resident?.nickname ?? ''} 的日记</h2>
        <PixelButton
          className="min-h-0 px-3 py-1 text-xs"
          onClick={() => write.mutate()}
          disabled={write.isPending}
        >
          写一篇
        </PixelButton>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {diaryQuery.isLoading ? (
        <p className="mt-2 text-xs text-ink/60">加载中…</p>
      ) : entries.length === 0 ? (
        <p className="mt-2 text-xs text-ink/60">还没有日记。跨游戏日或心情波动时居民会自己写，也可以手动点「写一篇」。</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {entries.map((e) => (
            <li key={e.id} className="rounded border-2 border-ink/10 bg-cream px-3 py-2">
              <div className="flex items-center gap-2 text-[10px] text-ink/50">
                <span className="font-pixel">
                  第 {e.game_day + 1} 天 {e.game_hour} 时
                </span>
                <span>心情 {e.mood}</span>
                {TRIGGER_LABEL[e.trigger] && <span>· {TRIGGER_LABEL[e.trigger]}</span>}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">{e.content}</p>
            </li>
          ))}
        </ul>
      )}
    </PixelCard>
  )
}

function errorMessage(e: unknown): string {
  return e instanceof ApiClientError ? e.message : '网络异常，请稍后再试'
}

function Avatar({ resident, size = 40 }: { resident: ResidentOut; size?: number }) {
  return (
    <img
      src={renderCharacterDataURL(resident.avatar)}
      alt={resident.nickname}
      width={size}
      height={size}
      className="shrink-0 rounded border-2 border-ink/15 bg-cream-deep p-0.5"
    />
  )
}

function CreateRelationshipForm({ residents }: { residents: ResidentOut[] }) {
  const queryClient = useQueryClient()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [type, setType] = useState<RelationType>('spouse')
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: (data: { resident_id: string; other_resident_id: string; relation_type: RelationType }) =>
      api.relationships.create(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['relationships'] })
      await queryClient.invalidateQueries({ queryKey: ['family-tree'] })
      setError('')
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!a || !b) return
    create.mutate({ resident_id: a, other_resident_id: b, relation_type: type })
  }

  const selectCls =
    'w-full rounded border-2 border-ink/20 bg-cream px-2 py-1.5 text-sm text-ink focus:border-wbrown focus:outline-none'

  return (
    <PixelCard className="w-full">
      <h2 className="font-pixel text-xs text-wbrown">建立关系</h2>
      <form className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onSubmit}>
        <label className="flex-1 text-sm font-semibold text-ink/80">
          居民甲
          <select className={`mt-1 ${selectCls}`} value={a} onChange={(e) => setA(e.target.value)} required>
            <option value="">选择居民</option>
            {residents.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nickname}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 text-sm font-semibold text-ink/80">
          居民乙
          <select className={`mt-1 ${selectCls}`} value={b} onChange={(e) => setB(e.target.value)} required>
            <option value="">选择居民</option>
            {residents
              .filter((r) => r.id !== a)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nickname}
                </option>
              ))}
          </select>
        </label>
        <label className="flex-1 text-sm font-semibold text-ink/80">
          关系
          <select
            className={`mt-1 ${selectCls}`}
            value={type}
            onChange={(e) => setType(e.target.value as RelationType)}
          >
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <PixelButton type="submit" disabled={create.isPending || !a || !b || a === b}>
          建立
        </PixelButton>
      </form>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {a && b && a === b && <p className="mt-2 text-xs text-red-600">不能与自身建立关系</p>}
    </PixelCard>
  )
}

function RelationshipList({
  items,
  residents,
}: {
  items: RelationshipItem[]
  residents: ResidentOut[]
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const byId = new Map(residents.map((r) => [r.id, r]))

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'accepted' | 'ended' }) =>
      api.relationships.update(id, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['relationships'] })
      await queryClient.invalidateQueries({ queryKey: ['family-tree'] })
      setError('')
    },
    onError: (e) => setError(errorMessage(e)),
  })

  if (items.length === 0) {
    return <p className="mt-2 text-xs text-ink/60">还没有关系，先从上面建立一段吧。</p>
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {TYPE_ORDER.map((t) => {
        const group = items.filter((i) => i.relationship.relation_type === t)
        if (group.length === 0) return null
        return (
          <div key={t}>
            <h3 className="font-pixel text-[10px] text-ink/50">{TYPE_LABEL[t]}</h3>
            <ul className="mt-1 flex flex-col gap-1.5">
              {group.map((item) => {
                const other = byId.get(item.other.id)
                return (
                  <li
                    key={item.relationship.id}
                    className="flex items-center gap-3 rounded border-2 border-ink/10 bg-cream px-3 py-2"
                  >
                    {other && <Avatar resident={other} size={32} />}
                    <span className="flex-1 text-sm font-semibold text-ink">{item.other.nickname}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-pixel ${
                        item.relationship.status === 'accepted'
                          ? 'bg-sage/40 text-ink/70'
                          : 'bg-pink/30 text-ink/70'
                      }`}
                    >
                      {STATUS_LABEL[item.relationship.status] ?? item.relationship.status}
                    </span>
                    {item.relationship.status === 'pending' && (
                      <PixelButton
                        className="min-h-0 px-3 py-1 text-xs"
                        onClick={() => update.mutate({ id: item.relationship.id, status: 'accepted' })}
                        disabled={update.isPending}
                      >
                        确认
                      </PixelButton>
                    )}
                    <PixelButton
                      className="min-h-0 px-3 py-1 text-xs"
                      variant="outline"
                      onClick={() => update.mutate({ id: item.relationship.id, status: 'ended' })}
                      disabled={update.isPending}
                    >
                      解除
                    </PixelButton>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function FamilyTree({ tree, residents }: { tree: FamilyTreeOut; residents: ResidentOut[] }) {
  const byId = new Map(residents.map((r) => [r.id, r]))
  const maxDepth = Math.max(0, ...tree.nodes.map((n) => n.depth))
  const layers: Array<typeof tree.nodes> = []
  for (let d = 0; d <= maxDepth; d++) layers.push(tree.nodes.filter((n) => n.depth === d))

  if (tree.edges.length === 0) {
    return <p className="mt-2 text-xs text-ink/60">家谱还是空的——结婚和结拜的关系确认后会出现在这里。</p>
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      {layers.map((layer, d) => (
        <div key={d} className="flex flex-wrap items-center justify-center gap-2">
          {layer.map((node) => {
            const resident = byId.get(node.id)
            return (
              <div
                key={node.id}
                className={`flex flex-col items-center gap-1 rounded border-2 px-3 py-2 ${
                  d === 0 ? 'border-wbrown/50 bg-cream-deep' : 'border-ink/10 bg-cream'
                }`}
              >
                {resident && <Avatar resident={resident} size={36} />}
                <span className="text-xs font-semibold text-ink">{node.nickname}</span>
              </div>
            )
          })}
        </div>
      ))}
      <ul className="mt-1 flex flex-col gap-1 border-t-2 border-ink/10 pt-2">
        {tree.edges.map((e, i) => {
          const nameOf = (id: string) => tree.nodes.find((n) => n.id === id)?.nickname ?? id
          return (
            <li key={i} className="text-center text-[10px] text-ink/50">
              {nameOf(e.a)} —— {TYPE_LABEL[e.relation_type]} —— {nameOf(e.b)}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function FamilyPage() {
  const residentsQuery = useQuery({ queryKey: ['residents'], queryFn: api.residents.list })
  const residents = residentsQuery.data ?? []
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    if (!selectedId && residents.length > 0) setSelectedId(residents[0].id)
  }, [residents, selectedId])

  const relationshipsQuery = useQuery({
    queryKey: ['relationships', selectedId],
    queryFn: () => api.relationships.list(selectedId),
    enabled: !!selectedId,
  })
  const treeQuery = useQuery({
    queryKey: ['family-tree', selectedId],
    queryFn: () => api.relationships.familyTree(selectedId),
    enabled: !!selectedId,
  })

  const selectCls =
    'rounded border-2 border-ink/20 bg-cream px-2 py-1.5 text-sm text-ink focus:border-wbrown focus:outline-none'

  if (residentsQuery.isLoading) {
    return <p className="font-pixel text-xs text-wbrown">加载中…</p>
  }
  if (residents.length < 1) {
    return (
      <PixelCard className="w-full">
        <p className="text-sm text-ink/70">还没有居民。先去「居民」页创造至少两位居民，再来组家庭。</p>
      </PixelCard>
    )
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <PixelCard className="w-full">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-pixel text-sm text-wbrown">家庭</h1>
          <select
            className={selectCls}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            aria-label="选择居民"
          >
            {residents.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nickname} 的视角
              </option>
            ))}
          </select>
        </div>
      </PixelCard>

      <CreateRelationshipForm residents={residents} />

      <PixelCard className="w-full">
        <h2 className="font-pixel text-xs text-wbrown">关系</h2>
        {relationshipsQuery.isLoading ? (
          <p className="mt-2 text-xs text-ink/60">加载中…</p>
        ) : relationshipsQuery.isError ? (
          <p className="mt-2 text-xs text-red-600">{errorMessage(relationshipsQuery.error)}</p>
        ) : (
          <RelationshipList items={relationshipsQuery.data ?? []} residents={residents} />
        )}
      </PixelCard>

      <PixelCard className="w-full">
        <h2 className="font-pixel text-xs text-wbrown">家谱</h2>
        {treeQuery.isLoading ? (
          <p className="mt-2 text-xs text-ink/60">加载中…</p>
        ) : treeQuery.isError ? (
          <p className="mt-2 text-xs text-red-600">{errorMessage(treeQuery.error)}</p>
        ) : (
          treeQuery.data && <FamilyTree tree={treeQuery.data} residents={residents} />
        )}
      </PixelCard>

      {selectedId && <DiarySection residentId={selectedId} residents={residents} />}
    </div>
  )
}
