import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PixelButton, PixelCard } from '@cyber-universe/ui'
import {
  api,
  ChatSocket,
  defaultSession,
  type SessionOut,
} from '@cyber-universe/api-client'

/** 对话中的一条展示消息：流式期间文本持续增长。 */
interface DisplayMessage {
  key: string
  role: 'me' | 'resident'
  residentId: string | null
  nickname: string
  content: string
  streaming?: boolean
  error?: boolean
}

export function ChatPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [activeId, setActiveId] = useState<string | null>(params.get('session') ?? null)
  const [draft, setDraft] = useState('')
  const [display, setDisplay] = useState<DisplayMessage[]>([])
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<ChatSocket | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const sessions = useQuery({ queryKey: ['chat-sessions'], queryFn: () => api.chat.listSessions() })
  const residents = useQuery({ queryKey: ['residents'], queryFn: () => api.residents.list() })

  const residentName = (id: string | null): string =>
    residents.data?.find((r) => r.id === id)?.nickname ?? '居民'

  const active: SessionOut | null = sessions.data?.find((s) => s.id === activeId) ?? null

  // ?with=<residentId>：直接进入与该居民的 DM
  useEffect(() => {
    const withId = params.get('with')
    if (!withId || !residents.data) return
    const target = sessions.data?.find(
      (s) => s.kind === 'dm' && s.resident_ids.includes(withId),
    )
    if (target) {
      setActiveId(target.id)
      void setParams({}, { replace: true })
      return
    }
    api.chat
      .createSession({ kind: 'dm', resident_ids: [withId] })
      .then((s) => {
        void queryClient.invalidateQueries({ queryKey: ['chat-sessions'] })
        setActiveId(s.id)
        void setParams({}, { replace: true })
      })
      .catch(() => setParams({}, { replace: true }))
  }, [params, residents.data, sessions.data, queryClient, setParams])

  // 历史消息 → 展示消息（切换会话时）
  useEffect(() => {
    if (!activeId) {
      setDisplay([])
      return
    }
    let cancelled = false
    api.chat
      .getMessages(activeId)
      .then((msgs) => {
        if (cancelled) return
        setDisplay(
          msgs.map((m) => ({
            key: m.id,
            role: m.sender_user_id ? ('me' as const) : ('resident' as const),
            residentId: m.sender_resident_id,
            nickname: m.sender_user_id ? '我' : residentName(m.sender_resident_id),
            content: m.content,
          })),
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, residents.data])

  // WebSocket 生命周期
  useEffect(() => {
    if (!activeId) return
    const token = defaultSession.storage.getAccess()
    if (!token) return
    const socket = new ChatSocket()
    socketRef.current = socket
    setConnected(false)
    socket.onEvent = (event) => {
      if (event.type === 'user_message') {
        setDisplay((d) => [
          ...d,
          {
            key: event.message.id,
            role: 'me',
            residentId: null,
            nickname: '我',
            content: event.message.content,
          },
        ])
      } else if (event.type === 'ai_stream') {
        setDisplay((d) => {
          const last = d[d.length - 1]
          if (last && last.streaming && last.residentId === event.resident_id) {
            const next = d.slice(0, -1)
            return [...next, { ...last, content: last.content + event.delta }]
          }
          return [
            ...d,
            {
              key: `stream-${event.resident_id}-${Date.now()}`,
              role: 'resident',
              residentId: event.resident_id,
              nickname: residentName(event.resident_id),
              content: event.delta,
              streaming: true,
            },
          ]
        })
      } else if (event.type === 'ai_done') {
        setDisplay((d) =>
          d.map((m) =>
            m.streaming && m.residentId === event.resident_id
              ? { ...m, streaming: false, content: event.message.content, key: event.message.id }
              : m,
          ),
        )
        void queryClient.invalidateQueries({ queryKey: ['chat-sessions'] })
      } else if (event.type === 'ai_error') {
        setDisplay((d) =>
          d.map((m) =>
            m.streaming && m.residentId === event.resident_id
              ? { ...m, streaming: false, error: true, content: event.error }
              : m,
          ),
        )
      }
    }
    socket.onClose = () => setConnected(false)
    socket.connect(activeId, token)
    setConnected(true)
    return () => {
      socketRef.current = null
      socket.close()
      setConnected(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [display])

  const canSend = useMemo(
    () => connected && draft.trim().length > 0,
    [connected, draft],
  )

  const onSend = (e: FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    if (!content || !canSend) return
    socketRef.current?.sendMessage(content)
    setDraft('')
  }

  const openSession = (s: SessionOut) => navigate(`/chat?session=${s.id}`)

  useEffect(() => {
    if (params.get('session')) setActiveId(params.get('session'))
  }, [params])

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      {/* 会话列表 */}
      <PixelCard className="max-h-[70vh] overflow-y-auto p-3">
        <h2 className="px-1 font-pixel text-[10px] text-wbrown">会话</h2>
        {sessions.isLoading && <p className="mt-2 px-1 text-xs text-ink/50">加载中…</p>}
        {sessions.data?.length === 0 && (
          <p className="mt-2 px-1 text-xs text-ink/50">
            还没有会话。去「居民」页创造一位居民，或在世界里走近 TA。
          </p>
        )}
        <ul className="mt-2 flex flex-col gap-1">
          {sessions.data?.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => openSession(s)}
                className={[
                  'w-full rounded px-3 py-2 text-left text-sm transition-colors',
                  s.id === activeId ? 'bg-sage/30 font-semibold text-sage-dark' : 'text-ink/70 hover:bg-cream-deep',
                ].join(' ')}
              >
                <span className="block truncate">
                  {s.kind === 'dm'
                    ? residentName(s.resident_ids[0] ?? null)
                    : (s.name ?? `群聊（${s.resident_ids.length + 1} 人）`)}
                </span>
                {s.last_message && <span className="block truncate text-xs text-ink/40">{s.last_message}</span>}
              </button>
            </li>
          ))}
        </ul>
      </PixelCard>

      {/* 对话窗口 */}
      <PixelCard className="flex max-h-[70vh] flex-col p-3">
        <div className="flex items-center justify-between border-b-2 border-ink/10 pb-2">
          <h2 className="font-pixel text-[10px] text-wbrown">
            {active
              ? active.kind === 'dm'
                ? residentName(active.resident_ids[0] ?? null)
                : (active.name ?? '群聊')
              : '聊天'}
          </h2>
          <span
            className={[
              'rounded-full px-2 py-0.5 text-xs font-semibold',
              connected ? 'bg-sage/30 text-sage-dark' : 'bg-cream-deep text-ink/40',
            ].join(' ')}
          >
            {connected ? '已连接' : '未连接'}
          </span>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto py-3">
          {!active && <p className="pt-8 text-center text-sm text-ink/40">选择左侧会话开始聊天</p>}
          {active && display.length === 0 && (
            <p className="pt-8 text-center text-sm text-ink/40">打个招呼吧，TA 会认真回复你。</p>
          )}
          {display.map((m) => (
            <div key={m.key} className={m.role === 'me' ? 'text-right' : 'text-left'}>
              <p className="text-xs font-semibold text-ink/40">{m.nickname}</p>
              <p
                className={[
                  'mt-0.5 inline-block max-w-[80%] whitespace-pre-wrap rounded-lg border-2 px-3 py-2 text-sm',
                  m.role === 'me'
                    ? 'border-sage-dark/40 bg-sage/20 text-ink'
                    : m.error
                      ? 'border-pink-dark/40 bg-pink/20 text-pink-dark'
                      : 'border-wbrown/30 bg-cream-deep text-ink',
                ].join(' ')}
              >
                {m.content}
                {m.streaming && <span className="animate-pulse text-ink/40">▌</span>}
              </p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form className="flex gap-2 border-t-2 border-ink/10 pt-3" onSubmit={onSend}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={active ? (connected ? '说点什么…' : '连接中…') : '先选择一个会话'}
            disabled={!active || !connected}
            maxLength={4000}
            className="min-h-[44px] flex-1 rounded border-2 border-ink/15 bg-cream px-3 py-2 text-base outline-none focus:border-sage-dark disabled:opacity-50"
            aria-label="消息输入框"
          />
          <PixelButton type="submit" disabled={!canSend}>
            发送
          </PixelButton>
        </form>
      </PixelCard>
    </div>
  )
}
