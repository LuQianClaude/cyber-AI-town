import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PixelButton, PixelCard, PixelInput } from '@cyber-universe/ui'
import {
  api,
  ApiClientError,
  type AvatarConfig,
  type ModelConfigOut,
  type ResidentOut,
} from '@cyber-universe/api-client'
import { renderCharacterDataURL } from '@cyber-universe/game-engine'

const COLOR_FIELDS: Array<{ key: keyof AvatarConfig; label: string }> = [
  { key: 'hair', label: '发色' },
  { key: 'hairShade', label: '发影' },
  { key: 'eyes', label: '瞳色' },
  { key: 'outfit', label: '衣服' },
  { key: 'outfitShade', label: '衣影' },
  { key: 'skin', label: '肤色' },
]

const DEFAULT_AVATAR: AvatarConfig = {
  hair: '#26262C',
  hairShade: '#17171B',
  eyes: '#4A3B2F',
  outfit: '#F3E9DC',
  outfitShade: '#DCCDB8',
  skin: '#F8E7D8',
  longHair: true,
}

function errorMessage(e: unknown): string {
  return e instanceof ApiClientError ? e.message : '网络异常，请稍后再试'
}

function ResidentForm({
  initial,
  configs,
  onDone,
}: {
  initial: ResidentOut | null
  configs: ModelConfigOut[]
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [nickname, setNickname] = useState(initial?.nickname ?? '')
  const [persona, setPersona] = useState(initial?.persona ?? '')
  const [background, setBackground] = useState(initial?.background ?? '')
  const [languageStyle, setLanguageStyle] = useState(initial?.language_style ?? '')
  const [activity, setActivity] = useState(initial?.current_activity ?? '在家附近散步')
  const [avatar, setAvatar] = useState<AvatarConfig>({ ...DEFAULT_AVATAR, ...(initial?.avatar ?? {}) })
  const [modelConfigId, setModelConfigId] = useState(initial?.model_config_id ?? '')
  const [error, setError] = useState('')

  const preview = useMemo(() => renderCharacterDataURL(avatar), [avatar])

  const save = useMutation({
    mutationFn: (data: Parameters<typeof api.residents.create>[0]) =>
      initial ? api.residents.update(initial.id, data) : api.residents.create(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['residents'] })
      onDone()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    save.mutate({
      nickname: nickname.trim(),
      persona: persona.trim(),
      background: background.trim(),
      language_style: languageStyle.trim(),
      current_activity: activity.trim() || '在家附近散步',
      avatar,
      model_config_id: modelConfigId || null,
    })
  }

  return (
    <PixelCard className="w-full max-w-lg">
      <h2 className="font-pixel text-xs text-wbrown">{initial ? '编辑居民' : '创造一位居民'}</h2>
      <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex items-start gap-4">
          <img
            src={preview}
            alt="头像预览"
            width={96}
            height={96}
            className="shrink-0 rounded border-2 border-ink/15 bg-cream-deep p-1"
          />
          <div className="flex-1">
            <PixelInput
              label="昵称"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              maxLength={30}
              placeholder="给 TA 起个名字"
            />
            <label className="mt-2 flex items-center gap-2 text-sm font-semibold text-ink/80">
              <input
                type="checkbox"
                checked={avatar.longHair}
                onChange={(e) => setAvatar({ ...avatar, longHair: e.target.checked })}
              />
              长发（侧辫）
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COLOR_FIELDS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm font-semibold text-ink/80">
              <input
                type="color"
                value={avatar[key] as string}
                onChange={(e) => setAvatar({ ...avatar, [key]: e.target.value })}
                aria-label={label}
                className="h-9 w-12 cursor-pointer rounded border-2 border-ink/15 bg-cream"
              />
              {label}
            </label>
          ))}
        </div>

        <PixelInput
          label="人格设定"
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          placeholder="性格、口头禅、行为习惯…"
        />
        <PixelInput
          label="背景故事"
          value={background}
          onChange={(e) => setBackground(e.target.value)}
          placeholder="TA 从哪里来，经历过什么…"
        />
        <PixelInput
          label="语言风格"
          value={languageStyle}
          onChange={(e) => setLanguageStyle(e.target.value)}
          placeholder="温柔克制 / 活泼跳脱 / 古风…"
        />
        <PixelInput label="当前活动" value={activity} onChange={(e) => setActivity(e.target.value)} maxLength={50} />

        <label className="flex flex-col gap-1 text-sm font-semibold text-ink/80">
          模型配置
          <select
            value={modelConfigId}
            onChange={(e) => setModelConfigId(e.target.value)}
            className="min-h-[44px] rounded border-2 border-ink/15 bg-cream px-3 py-2 text-base outline-none focus:border-sage-dark"
          >
            <option value="">未配置（不会上线）</option>
            {configs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.provider}/{c.model}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p role="alert" className="rounded border-2 border-pink-dark/40 bg-pink/20 px-3 py-2 text-sm text-pink-dark">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <PixelButton type="submit" disabled={save.isPending} className="flex-1">
            {save.isPending ? '保存中…' : '保存'}
          </PixelButton>
          <PixelButton type="button" variant="outline" onClick={onDone}>
            取消
          </PixelButton>
        </div>
      </form>
    </PixelCard>
  )
}

/** AI 居民管理：网格 + 创建/编辑/删除。 */
export function ResidentsPage() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<ResidentOut | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<ResidentOut | null>(null)

  const residents = useQuery({ queryKey: ['residents'], queryFn: () => api.residents.list() })
  const configs = useQuery({ queryKey: ['model-configs'], queryFn: () => api.modelConfigs.list() })

  const remove = useMutation({
    mutationFn: (id: string) => api.residents.remove(id),
    onSuccess: async () => {
      setConfirmDelete(null)
      await queryClient.invalidateQueries({ queryKey: ['residents'] })
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-pixel text-sm text-wbrown">AI 居民</h1>
          <p className="mt-1 text-sm text-ink/60">
            {residents.data?.length ?? 0} 位居民 · 配好模型配置的居民会在世界里上线
          </p>
        </div>
        <PixelButton onClick={() => setCreating(true)}>创造居民</PixelButton>
      </div>

      {residents.isLoading && <p className="text-sm text-ink/50">加载中…</p>}
      {residents.error && <p className="text-sm text-pink-dark">{errorMessage(residents.error)}</p>}

      {residents.data && residents.data.length > 0 && !creating && !editing && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {residents.data.map((r) => (
            <PixelCard key={r.id} className="flex flex-col items-center gap-2 text-center">
              <img
                src={renderCharacterDataURL(r.avatar)}
                alt={`${r.nickname} 的头像`}
                width={64}
                height={64}
                className="rounded border-2 border-ink/10 bg-cream-deep"
              />
              <p className="font-semibold text-ink">{r.nickname}</p>
              <p className="text-xs text-ink/50">{r.current_activity}</p>
              <span
                className={[
                  'rounded-full px-2 py-0.5 text-xs font-semibold',
                  r.is_online ? 'bg-sage/30 text-sage-dark' : 'bg-cream-deep text-ink/40',
                ].join(' ')}
              >
                {r.is_online ? '在线' : '离线'}
              </span>
              <div className="mt-1 flex gap-2">
                <PixelButton variant="outline" className="min-h-[36px] px-3 py-1 text-sm" onClick={() => setEditing(r)}>
                  编辑
                </PixelButton>
                <PixelButton
                  variant="outline"
                  className="min-h-[36px] border-pink-dark/40 px-3 py-1 text-sm text-pink-dark"
                  onClick={() => setConfirmDelete(r)}
                >
                  删除
                </PixelButton>
              </div>
            </PixelCard>
          ))}
        </div>
      )}

      {residents.data?.length === 0 && !creating && !editing && (
        <PixelCard className="py-10 text-center">
          <p className="text-sm text-ink/60">还没有居民。创造第一位 AI 居民，TA 会住进你的小岛。</p>
        </PixelCard>
      )}

      {(creating || editing) && (
        <ResidentForm
          initial={editing}
          configs={configs.data ?? []}
          onDone={() => {
            setCreating(false)
            setEditing(null)
          }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 px-4" role="dialog" aria-modal="true">
          <PixelCard className="w-full max-w-sm">
            <p className="text-sm text-ink">
              确定要送 <span className="font-semibold">{confirmDelete.nickname}</span> 离开宇宙吗？
              TA 的记忆、聊天记录都会被清除，且无法恢复。
            </p>
            {remove.error && <p className="mt-2 text-sm text-pink-dark">{errorMessage(remove.error)}</p>}
            <div className="mt-4 flex gap-3">
              <PixelButton
                className="flex-1 border-pink-dark bg-pink-dark"
                disabled={remove.isPending}
                onClick={() => remove.mutate(confirmDelete.id)}
              >
                {remove.isPending ? '删除中…' : '确认删除'}
              </PixelButton>
              <PixelButton variant="outline" onClick={() => setConfirmDelete(null)}>
                再想想
              </PixelButton>
            </div>
          </PixelCard>
        </div>
      )}
    </div>
  )
}
