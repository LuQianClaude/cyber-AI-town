// © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PixelButton, PixelCard, PixelInput } from '@cyber-universe/ui'
import {
  api,
  ApiClientError,
  type CalendarDayOut,
  type ResidentOut,
} from '@cyber-universe/api-client'

function errorMessage(e: unknown): string {
  return e instanceof ApiClientError ? e.message : '网络异常，请稍后再试'
}

const PHASE_LABEL: Record<string, string> = {
  dawn: '清晨',
  morning: '上午',
  noon: '中午',
  afternoon: '下午',
  evening: '傍晚',
  night: '夜晚',
}

function CreateEventForm({
  residents,
  today,
  onDone,
}: {
  residents: ResidentOut[]
  today: number
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [offset, setOffset] = useState(0)
  const [hour, setHour] = useState(18)
  const [residentId, setResidentId] = useState('')
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: () =>
      api.calendar.createEvent({
        title: title.trim(),
        game_day: today + offset,
        game_hour: hour,
        resident_id: residentId || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['calendar'] })
      setTitle('')
      setError('')
      onDone()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    create.mutate()
  }

  const selectCls =
    'rounded border-2 border-ink/20 bg-cream px-2 py-1.5 text-sm text-ink focus:border-wbrown focus:outline-none'

  return (
    <form className="mt-3 flex flex-col gap-2" onSubmit={onSubmit}>
      <PixelInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="做什么？比如：海边看日落" maxLength={80} />
      <div className="flex flex-wrap items-center gap-2">
        <select className={selectCls} value={offset} onChange={(e) => setOffset(Number(e.target.value))}>
          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
            <option key={d} value={d}>
              {d === 0 ? '今天' : d === 1 ? '明天' : `${d} 天后`}
            </option>
          ))}
        </select>
        <select className={selectCls} value={hour} onChange={(e) => setHour(Number(e.target.value))}>
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {h} 时
            </option>
          ))}
        </select>
        <select className={selectCls} value={residentId} onChange={(e) => setResidentId(e.target.value)}>
          <option value="">自己</option>
          {residents.map((r) => (
            <option key={r.id} value={r.id}>
              和 {r.nickname}
            </option>
          ))}
        </select>
        <PixelButton type="submit" disabled={create.isPending || !title.trim()}>
          记下
        </PixelButton>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  )
}

export function CalendarPage() {
  const [showForm, setShowForm] = useState(false)
  const queryClient = useQueryClient()
  const clockQuery = useQuery({ queryKey: ['calendar', 'clock'], queryFn: api.calendar.clock })
  const residentsQuery = useQuery({ queryKey: ['residents'], queryFn: api.residents.list })
  const today = clockQuery.data?.day ?? 0
  const daysQuery = useQuery({
    queryKey: ['calendar', 'days', today],
    queryFn: () => api.calendar.days(today - 1, today + 6),
    enabled: clockQuery.isSuccess,
    refetchInterval: 60_000,
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.calendar.deleteEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar', 'days'] }),
  })

  const residents = residentsQuery.data ?? []
  const byDay = new Map<number, CalendarDayOut>((daysQuery.data ?? []).map((d) => [d.game_day, d]))
  const strip = Array.from({ length: 7 }, (_, i) => today - 1 + i)

  return (
    <div className="flex w-full max-w-2xl flex-col gap-3">
      <PixelCard className="w-full">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-pixel text-sm text-wbrown">日历</h1>
            <p className="mt-1 text-xs text-ink/60">
              {clockQuery.data
                ? `${clockQuery.data.display} · ${PHASE_LABEL[clockQuery.data.phase] ?? clockQuery.data.phase}`
                : '加载中…'}
            </p>
          </div>
          <PixelButton className="min-h-0 px-3 py-1 text-xs" onClick={() => setShowForm((v) => !v)}>
            {showForm ? '收起' : '＋ 约定'}
          </PixelButton>
        </div>
        {showForm && (
          <CreateEventForm residents={residents} today={today} onDone={() => setShowForm(false)} />
        )}
      </PixelCard>

      <div className="grid grid-cols-7 gap-1">
        {strip.map((d) => {
          const has = byDay.has(d)
          return (
            <div
              key={d}
              className={`flex flex-col items-center rounded border-2 py-2 ${
                d === today ? 'border-wbrown/60 bg-cream-deep' : 'border-ink/10 bg-cream'
              }`}
            >
              <span className="text-[10px] text-ink/50">{d === today ? '今天' : `第${d + 1}天`}</span>
              <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${has ? 'bg-pink' : 'bg-transparent'}`} />
            </div>
          )
        })}
      </div>

      <PixelCard className="w-full">
        <h2 className="font-pixel text-xs text-wbrown">接下来</h2>
        {daysQuery.isLoading ? (
          <p className="mt-2 text-xs text-ink/60">加载中…</p>
        ) : daysQuery.isError ? (
          <p className="mt-2 text-xs text-red-600">{errorMessage(daysQuery.error)}</p>
        ) : (daysQuery.data ?? []).length === 0 ? (
          <p className="mt-2 text-xs text-ink/60">这几天还什么都没有。世界事件每天自动生成，约定可以手动记。</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {(daysQuery.data ?? []).flatMap((d) =>
              d.events.map((e) => {
                const mate = residents.find((r) => r.id === e.resident_id)
                return (
                  <li
                    key={e.id}
                    className="flex items-center gap-3 rounded border-2 border-ink/10 bg-cream px-3 py-2"
                  >
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-pixel ${
                        e.kind === 'world' ? 'bg-sky/40 text-ink/70' : 'bg-pink/30 text-ink/70'
                      }`}
                    >
                      {e.kind === 'world' ? '世界' : '约定'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {e.title}
                        {mate && <span className="ml-1 text-xs font-normal text-ink/50">· 和 {mate.nickname}</span>}
                      </p>
                      {e.content && <p className="truncate text-xs text-ink/60">{e.content}</p>}
                    </div>
                    <span className="shrink-0 text-[10px] text-ink/50">
                      {e.game_day === today ? '今天' : `第${e.game_day + 1}天`} {e.game_hour}时
                    </span>
                    {e.kind === 'appointment' && (
                      <PixelButton
                        variant="outline"
                        className="min-h-0 px-2 py-1 text-[10px]"
                        onClick={() => remove.mutate(e.id)}
                        disabled={remove.isPending}
                      >
                        删
                      </PixelButton>
                    )}
                  </li>
                )
              }),
            )}
          </ul>
        )}
      </PixelCard>
    </div>
  )
}
