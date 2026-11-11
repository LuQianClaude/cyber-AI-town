// © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PixelButton, PixelCard, PixelInput } from '@cyber-universe/ui'
import {
  api,
  ApiClientError,
  type LetterOut,
  type ResidentOut,
} from '@cyber-universe/api-client'
import { renderCharacterDataURL } from '@cyber-universe/game-engine'

function errorMessage(e: unknown): string {
  return e instanceof ApiClientError ? e.message : '网络异常，请稍后再试'
}

function fmt(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function Avatar({ resident, size = 36 }: { resident: ResidentOut; size?: number }) {
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

function ThreadView({
  resident,
  residents,
  onBack,
}: {
  resident: ResidentOut
  residents: ResidentOut[]
  onBack: () => void
}) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const lettersQuery = useQuery({
    queryKey: ['mailbox', 'letters', resident.id],
    queryFn: () => api.mailbox.letters(resident.id),
  })

  const markRead = useMutation({
    mutationFn: (id: string) => api.mailbox.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mailbox'] }),
  })

  const send = useMutation({
    mutationFn: (content: string) => api.mailbox.send({ resident_id: resident.id, content }),
    onSuccess: async () => {
      setDraft('')
      setError('')
      await queryClient.invalidateQueries({ queryKey: ['mailbox'] })
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    send.mutate(draft.trim())
  }

  const me = residents.find((r) => r.id === resident.id) ?? resident
  const letters = lettersQuery.data ?? []

  return (
    <PixelCard className="w-full">
      <div className="flex items-center gap-3">
        <PixelButton variant="outline" className="min-h-0 px-3 py-1 text-xs" onClick={onBack}>
          ← 返回
        </PixelButton>
        <Avatar resident={me} size={32} />
        <h2 className="font-pixel text-xs text-wbrown">和 {resident.nickname} 的信件</h2>
      </div>

      <div className="mt-3 flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
        {lettersQuery.isLoading && <p className="text-xs text-ink/60">加载中…</p>}
        {lettersQuery.isError && <p className="text-xs text-red-600">{errorMessage(lettersQuery.error)}</p>}
        {letters.map((l) => (
          <LetterBubble key={l.id} letter={l} nickname={resident.nickname} onShow={() => !l.is_read && markRead.mutate(l.id)} />
        ))}
        {lettersQuery.data?.length === 0 && (
          <p className="text-xs text-ink/60">还没有信件，写第一封吧。</p>
        )}
      </div>

      <form className="mt-3 flex flex-col gap-2" onSubmit={onSubmit}>
        <PixelInput
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`写给 ${resident.nickname}…`}
          maxLength={2000}
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-ink/40">{draft.length}/2000</span>
          <PixelButton type="submit" disabled={send.isPending || !draft.trim()}>
            寄出
          </PixelButton>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
    </PixelCard>
  )
}

function LetterBubble({
  letter,
  nickname,
  onShow,
}: {
  letter: LetterOut
  nickname: string
  onShow: () => void
}) {
  const fromUser = letter.sender_kind === 'user'
  return (
    <div className={`flex ${fromUser ? 'justify-end' : 'justify-start'}`} onMouseEnter={onShow}>
      <div
        className={`max-w-[80%] rounded border-2 px-3 py-2 text-sm ${
          fromUser ? 'border-wbrown/40 bg-cream-deep text-ink' : 'border-ink/10 bg-cream text-ink'
        }`}
      >
        {!fromUser && (
          <p className="mb-1 text-[10px] font-pixel text-ink/50">
            {nickname}
            {!letter.is_read && <span className="ml-1 text-pink-dark">· 未读</span>}
          </p>
        )}
        <p className="whitespace-pre-wrap leading-relaxed">{letter.content}</p>
        <p className="mt-1 text-right text-[10px] text-ink/40">{fmt(letter.created_at)}</p>
      </div>
    </div>
  )
}

export function MailboxPage() {
  const [activeId, setActiveId] = useState('')
  const residentsQuery = useQuery({ queryKey: ['residents'], queryFn: api.residents.list })
  const summaryQuery = useQuery({
    queryKey: ['mailbox', 'summary'],
    queryFn: api.mailbox.summary,
    refetchInterval: 30_000,
  })
  const residents = residentsQuery.data ?? []
  const active = residents.find((r) => r.id === activeId)

  if (residentsQuery.isLoading) return <p className="font-pixel text-xs text-wbrown">加载中…</p>
  if (residents.length < 1) {
    return (
      <PixelCard className="w-full">
        <p className="text-sm text-ink/70">还没有居民。先去「居民」页创造一位，再来写信。</p>
      </PixelCard>
    )
  }

  if (active) {
    return (
      <div className="w-full max-w-2xl">
        <ThreadView resident={active} residents={residents} onBack={() => setActiveId('')} />
      </div>
    )
  }

  const summary = summaryQuery.data ?? []
  const byId = new Map(summary.map((s) => [s.resident_id, s]))

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3">
      <PixelCard className="w-full">
        <h1 className="font-pixel text-sm text-wbrown">信箱</h1>
        <p className="mt-1 text-xs text-ink/60">居民会回你的信，也会主动写给你。</p>
      </PixelCard>
      <PixelCard className="w-full">
        <ul className="flex flex-col gap-1.5">
          {residents.map((r) => {
            const s = byId.get(r.id)
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(r.id)}
                  className="flex w-full items-center gap-3 rounded border-2 border-ink/10 bg-cream px-3 py-2 text-left transition-colors hover:border-wbrown/40"
                >
                  <Avatar resident={r} size={32} />
                  <span className="flex-1 text-sm font-semibold text-ink">{r.nickname}</span>
                  {s && s.unread_count > 0 && (
                    <span className="rounded-full bg-pink px-2 py-0.5 text-[10px] font-pixel text-cream">
                      {s.unread_count} 封未读
                    </span>
                  )}
                  {s?.last_letter_at && (
                    <span className="text-[10px] text-ink/40">{fmt(s.last_letter_at)}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </PixelCard>
    </div>
  )
}
