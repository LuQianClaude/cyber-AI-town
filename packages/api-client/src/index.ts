// © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
import type { HealthResponse, ApiErrorBody } from '@cyber-universe/shared'
export * from '@cyber-universe/shared'

/** 可预期的客户端错误：携带 HTTP 状态与后端 detail。 */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    detail: string,
  ) {
    super(detail)
    this.name = 'ApiClientError'
  }
}

function resolveApiBase(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env
  return env?.VITE_API_URL ?? '/api'
}

const API_BASE = resolveApiBase()

// ---------------- 数据契约（与 backend/app/schemas/* 对齐） ----------------

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  user: UserOut
}

export interface UserOut {
  id: string
  email: string
  nickname: string
  avatar_url: string | null
  created_at: string
}

export interface AvatarConfig {
  hair: string
  hairShade: string
  eyes: string
  outfit: string
  outfitShade: string
  skin: string
  longHair: boolean
}

export type ProviderKind = 'openai' | 'anthropic' | 'gemini' | 'custom'

export interface ModelConfigOut {
  id: string
  name: string
  provider: ProviderKind
  base_url: string
  model: string
  temperature: number
  max_tokens: number
  streaming: boolean
  is_default: boolean
  has_api_key: boolean
  created_at: string
}

export interface ModelConfigCreate {
  name: string
  provider: ProviderKind
  base_url: string
  api_key: string
  model: string
  temperature?: number
  max_tokens?: number
  streaming?: boolean
  is_default?: boolean
}

export type ModelConfigUpdate = Partial<Omit<ModelConfigCreate, 'provider'>> & { provider?: ProviderKind }

export interface TestResult {
  ok: boolean
  latency_ms: number | null
  error: string | null
}

export interface ResidentOut {
  id: string
  nickname: string
  avatar: AvatarConfig
  persona: string
  background: string
  language_style: string
  model_config_id: string | null
  current_activity: string
  is_online: boolean
  created_at: string
}

export interface ResidentCreate {
  nickname: string
  avatar?: AvatarConfig
  persona?: string
  background?: string
  language_style?: string
  model_config_id?: string | null
  current_activity?: string
}

export type ResidentUpdate = Partial<ResidentCreate>

export interface MemoryOut {
  id: string
  resident_id: string
  content: string
  kind: 'private' | 'shared'
  created_at: string
}

export interface SessionOut {
  id: string
  kind: 'dm' | 'group'
  name: string | null
  created_at: string
  resident_ids: string[]
  last_message: string | null
}

// ---------------- M4 花园 / 信箱 / 日记 / 主动行为 ----------------

export interface GardenPlotOut {
  index: number
  crop: string | null
  crop_name: string | null
  stage: 'empty' | 'growing' | 'mature'
  progress: number
  remaining_minutes: number | null
  harvests: number
}

export interface LetterOut {
  id: string
  resident_id: string
  sender_kind: 'user' | 'resident'
  sender_resident_id: string | null
  content: string
  is_read: boolean
  reply_to_id: string | null
  created_at: string
}

export interface MailboxSummaryItem {
  resident_id: string
  nickname: string
  last_letter_at: string | null
  unread_count: number
}

export interface DiaryEntryOut {
  id: string
  resident_id: string
  game_day: number
  game_hour: number
  mood: number
  content: string
  trigger: string
  created_at: string
}

export interface ProactiveResult {
  letters: number
  greetings: number
  world_events: number
  skipped: boolean
}

export interface WorldClockOut {
  tick: number
  day: number
  game_hour: number
  game_minute: number
  phase: string
  display: string
}

export interface CalendarEventOut {
  id: string
  kind: 'world' | 'appointment'
  title: string
  content: string
  game_day: number
  game_hour: number
  resident_id: string | null
  created_at: string
}

export interface CalendarDayOut {
  game_day: number
  events: CalendarEventOut[]
}

// ---------------- M3 关系图谱 ----------------
export type RelationType = 'spouse' | 'sworn' | 'neighbor'
export type RelationStatus = 'pending' | 'accepted' | 'ended'

export interface RelationshipOut {
  id: string
  resident_id: string
  other_resident_id: string
  relation_type: RelationType
  status: RelationStatus
  created_at: string
  updated_at: string
}

export interface RelationshipItem {
  relationship: RelationshipOut
  other: { id: string; nickname: string; avatar: AvatarConfig }
}

export interface FamilyTreeNode {
  id: string
  nickname: string
  avatar: AvatarConfig
  depth: number
}

export interface FamilyTreeEdge {
  a: string
  b: string
  relation_type: RelationType
}

export interface FamilyTreeOut {
  root: string
  nodes: FamilyTreeNode[]
  edges: FamilyTreeEdge[]
}

export interface MessageOut {
  id: string
  session_id: string
  sender_user_id: string | null
  sender_resident_id: string | null
  content: string
  created_at: string
}

// ---------------- 令牌存储 ----------------

export interface TokenStorage {
  getAccess(): string | null
  getRefresh(): string | null
  setTokens(access: string, refresh: string): void
  clear(): void
}

export function createLocalTokenStorage(prefix = 'cyber-universe'): TokenStorage {
  const accessKey = `${prefix}:access`
  const refreshKey = `${prefix}:refresh`
  return {
    getAccess: () => localStorage.getItem(accessKey),
    getRefresh: () => localStorage.getItem(refreshKey),
    setTokens: (access, refresh) => {
      localStorage.setItem(accessKey, access)
      localStorage.setItem(refreshKey, refresh)
    },
    clear: () => {
      localStorage.removeItem(accessKey)
      localStorage.removeItem(refreshKey)
    },
  }
}

export function createMemoryTokenStorage(): TokenStorage {
  let access: string | null = null
  let refresh: string | null = null
  return {
    getAccess: () => access,
    getRefresh: () => refresh,
    setTokens: (a, r) => {
      access = a
      refresh = r
    },
    clear: () => {
      access = null
      refresh = null
    },
  }
}

// ---------------- 会话：认证请求 + 401 自动刷新 ----------------

export class ApiSession {
  private refreshPromise: Promise<boolean> | null = null

  constructor(public readonly storage: TokenStorage = createLocalTokenStorage()) {}

  private async rawRequest<T>(path: string, init: RequestInit = {}, auth: boolean): Promise<T> {
    const headers = new Headers(init.headers)
    headers.set('Content-Type', 'application/json')
    if (auth) {
      const token = this.storage.getAccess()
      if (token) headers.set('Authorization', `Bearer ${token}`)
    }
    let res: Response
    try {
      res = await fetch(`${API_BASE}${path}`, { ...init, headers })
    } catch {
      throw new ApiClientError(0, '无法连接服务器')
    }
    if (!res.ok) {
      let detail = `请求失败 (${res.status})`
      try {
        const body = (await res.json()) as ApiErrorBody
        if (typeof body.detail === 'string') detail = body.detail
      } catch {
        /* 非 JSON 错误体 */
      }
      throw new ApiClientError(res.status, detail)
    }
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  /** 带认证请求；401 时单飞刷新令牌并重试一次。 */
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    try {
      return await this.rawRequest<T>(path, init, true)
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401 && this.storage.getRefresh()) {
        if (await this.refreshTokens()) {
          return await this.rawRequest<T>(path, init, true)
        }
        this.storage.clear()
      }
      throw e
    }
  }

  /** 刷新令牌（单飞：并发 401 只触发一次）。成功返回 true。 */
  async refreshTokens(): Promise<boolean> {
    this.refreshPromise ??= (async () => {
      const refresh = this.storage.getRefresh()
      if (!refresh) return false
      try {
        const tokens = await this.rawRequest<AuthTokens>(
          '/auth/refresh',
          { method: 'POST', body: JSON.stringify({ refresh_token: refresh }) },
          false,
        )
        this.storage.setTokens(tokens.access_token, tokens.refresh_token)
        return true
      } catch {
        return false
      }
    })()
    try {
      return await this.refreshPromise
    } finally {
      this.refreshPromise = null
    }
  }
}

export const defaultSession = new ApiSession()

// ---------------- 资源 API ----------------

const body = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) })

export function createApi(session: ApiSession = defaultSession) {
  return {
    auth: {
      register: (data: { email: string; password: string; nickname?: string }) =>
        session.request<AuthTokens>('/auth/register', body('POST', data)),
      login: (data: { email: string; password: string }) =>
        session.request<AuthTokens>('/auth/login', body('POST', data)),
      refresh: () => session.refreshTokens(),
      me: () => session.request<UserOut>('/auth/me'),
      deleteAccount: (password: string) =>
        session.request<void>('/auth/me', body('DELETE', { password })),
    },
    modelConfigs: {
      list: () => session.request<ModelConfigOut[]>('/model-configs'),
      create: (data: ModelConfigCreate) =>
        session.request<ModelConfigOut>('/model-configs', body('POST', data)),
      update: (id: string, data: ModelConfigUpdate) =>
        session.request<ModelConfigOut>(`/model-configs/${id}`, body('PATCH', data)),
      remove: (id: string) => session.request<void>(`/model-configs/${id}`, { method: 'DELETE' }),
      test: (id: string) => session.request<TestResult>(`/model-configs/${id}/test`, { method: 'POST' }),
    },
    residents: {
      list: () => session.request<ResidentOut[]>('/residents'),
      create: (data: ResidentCreate) => session.request<ResidentOut>('/residents', body('POST', data)),
      update: (id: string, data: ResidentUpdate) =>
        session.request<ResidentOut>(`/residents/${id}`, body('PATCH', data)),
      remove: (id: string) => session.request<void>(`/residents/${id}`, { method: 'DELETE' }),
      listMemories: (residentId: string) => session.request<MemoryOut[]>(`/residents/${residentId}/memories`),
      createMemory: (residentId: string, data: { content: string; kind?: 'private' | 'shared' }) =>
        session.request<MemoryOut>(`/residents/${residentId}/memories`, body('POST', data)),
      updateMemory: (memoryId: string, data: { content?: string; kind?: 'private' | 'shared' }) =>
        session.request<MemoryOut>(`/residents/memories/${memoryId}`, body('PATCH', data)),
      deleteMemory: (memoryId: string) =>
        session.request<void>(`/residents/memories/${memoryId}`, { method: 'DELETE' }),
    },
    relationships: {
      list: (residentId: string) =>
        session.request<RelationshipItem[]>(`/relationships?resident_id=${encodeURIComponent(residentId)}`),
      create: (data: { resident_id: string; other_resident_id: string; relation_type: RelationType }) =>
        session.request<RelationshipItem>('/relationships', body('POST', data)),
      update: (id: string, data: { status: 'accepted' | 'ended' }) =>
        session.request<RelationshipItem>(`/relationships/${id}`, body('PATCH', data)),
      familyTree: (residentId: string) =>
        session.request<FamilyTreeOut>(`/relationships/family-tree/${encodeURIComponent(residentId)}`),
    },
    garden: {
      list: () => session.request<GardenPlotOut[]>('/garden'),
      plant: (index: number, crop: string) =>
        session.request<GardenPlotOut>(`/garden/plots/${index}/plant`, body('POST', { crop })),
      harvest: (index: number) => session.request<GardenPlotOut>(`/garden/plots/${index}/harvest`, body('POST', {})),
      clear: (index: number) => session.request<GardenPlotOut>(`/garden/plots/${index}/clear`, body('POST', {})),
    },
    mailbox: {
      summary: () => session.request<MailboxSummaryItem[]>('/mailbox/summary'),
      letters: (residentId: string) =>
        session.request<LetterOut[]>(`/mailbox/letters?resident_id=${encodeURIComponent(residentId)}`),
      send: (data: { resident_id: string; content: string }) =>
        session.request<LetterOut>('/mailbox/letters', body('POST', data)),
      markRead: (id: string) => session.request<LetterOut>(`/mailbox/letters/${id}/read`, body('POST', {})),
    },
    diary: {
      list: (residentId: string) =>
        session.request<DiaryEntryOut[]>(`/residents/${encodeURIComponent(residentId)}/diary/entries`),
      write: (residentId: string) =>
        session.request<DiaryEntryOut>(`/residents/${encodeURIComponent(residentId)}/diary/entries`, body('POST', {})),
    },
    proactive: {
      run: () => session.request<ProactiveResult>('/proactive/run', body('POST', {})),
    },
    calendar: {
      clock: () => session.request<WorldClockOut>('/calendar/clock'),
      days: (fromDay: number, toDay: number) =>
        session.request<CalendarDayOut[]>(`/calendar?from_day=${fromDay}&to_day=${toDay}`),
      createEvent: (data: {
        title: string
        content?: string
        game_day: number
        game_hour: number
        resident_id?: string | null
      }) => session.request<CalendarEventOut>('/calendar/events', body('POST', data)),
      deleteEvent: (id: string) => session.request<void>(`/calendar/events/${id}`, body('DELETE', {})),
    },
    chat: {
      listSessions: () => session.request<SessionOut[]>('/chat/sessions'),
      createSession: (data: { kind: 'dm' | 'group'; name?: string; resident_ids: string[] }) =>
        session.request<SessionOut>('/chat/sessions', body('POST', data)),
      getMessages: (sessionId: string, limit = 50) =>
        session.request<MessageOut[]>(`/chat/sessions/${sessionId}/messages?limit=${limit}`),
    },
  }
}

export type Api = ReturnType<typeof createApi>
export const api = createApi()

// ---------------- 聊天 WebSocket ----------------

export type ChatEvent =
  | { type: 'user_message'; message: MessageOut }
  | { type: 'ai_stream'; resident_id: string; delta: string }
  | { type: 'ai_done'; resident_id: string; message: MessageOut }
  | { type: 'ai_error'; resident_id: string; error: string }
  | { type: 'unknown'; raw: unknown }

function resolveWsBase(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env
  if (env?.VITE_WS_URL) return env.VITE_WS_URL
  if (typeof window !== 'undefined') {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    return `${scheme}://${window.location.host}/api`
  }
  return 'ws://localhost:8000/api'
}

export class ChatSocket {
  private ws: WebSocket | null = null
  private closedByUser = false
  onEvent: (event: ChatEvent) => void = () => {}
  onClose: (code: number) => void = () => {}

  connect(sessionId: string, accessToken: string, session: ApiSession = defaultSession): void {
    this.close()
    this.closedByUser = false
    const url = `${resolveWsBase()}/chat/ws/${sessionId}?token=${encodeURIComponent(accessToken)}`
    const ws = new WebSocket(url)
    this.ws = ws
    ws.onmessage = (e) => {
      let raw: unknown
      try {
        raw = JSON.parse(String(e.data))
      } catch {
        this.onEvent({ type: 'unknown', raw: e.data })
        return
      }
      const data = raw as Record<string, unknown>
      if (data.type === 'user_message' || data.type === 'ai_done') {
        this.onEvent({ type: data.type, message: data.message } as ChatEvent)
      } else if (data.type === 'ai_stream') {
        this.onEvent({ type: 'ai_stream', resident_id: String(data.resident_id), delta: String(data.delta) })
      } else if (data.type === 'ai_error') {
        this.onEvent({ type: 'ai_error', resident_id: String(data.resident_id), error: String(data.error) })
      } else {
        this.onEvent({ type: 'unknown', raw })
      }
    }
    ws.onclose = (e) => {
      if (this.ws !== ws) return
      this.ws = null
      if (!this.closedByUser && e.code === 4401 && session) {
        // 访问令牌过期：刷新后重连一次
        void session.refreshTokens().then((ok) => {
          if (ok) {
            const token = session.storage.getAccess()
            if (token) this.connect(sessionId, token, session)
          } else {
            this.onClose(e.code)
          }
        })
        return
      }
      this.onClose(e.code)
    }
    ws.onerror = () => {
      /* 具体错误由 onclose 统一处理 */
    }
  }

  sendMessage(content: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'user_message', content }))
    }
  }

  close(): void {
    this.closedByUser = true
    if (this.ws) {
      const ws = this.ws
      this.ws = null
      ws.onclose = null
      ws.close()
    }
  }
}

// ---------------- 公开工具 ----------------

export async function getHealth(): Promise<HealthResponse> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/health`)
  } catch {
    throw new ApiClientError(0, '无法连接服务器')
  }
  if (!res.ok) {
    let detail = `请求失败 (${res.status})`
    try {
      const errBody = (await res.json()) as ApiErrorBody
      if (typeof errBody.detail === 'string') detail = errBody.detail
    } catch {
      /* 非 JSON 错误体 */
    }
    throw new ApiClientError(res.status, detail)
  }
  return (await res.json()) as HealthResponse
}
