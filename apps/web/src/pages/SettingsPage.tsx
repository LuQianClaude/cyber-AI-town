import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PixelButton, PixelCard, PixelInput } from '@cyber-universe/ui'
import { api, ApiClientError, type ModelConfigOut, type ModelConfigUpdate, type ProviderKind } from '@cyber-universe/api-client'
import { useAuth } from '@/store/auth'

const PROVIDERS: Array<{ value: ProviderKind; label: string; hint: string }> = [
  { value: 'openai', label: 'OpenAI 兼容', hint: 'https://api.openai.com/v1' },
  { value: 'anthropic', label: 'Anthropic', hint: 'https://api.anthropic.com' },
  { value: 'gemini', label: 'Gemini', hint: 'https://generativelanguage.googleapis.com' },
  { value: 'custom', label: '自定义（OpenAI 兼容接口）', hint: '你的服务地址' },
]

function errorMessage(e: unknown): string {
  return e instanceof ApiClientError ? e.message : '网络异常，请稍后再试'
}

function ConfigForm({ initial, onDone }: { initial: ModelConfigOut | null; onDone: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(initial?.name ?? '')
  const [provider, setProvider] = useState<ProviderKind>(initial?.provider ?? 'openai')
  const [baseUrl, setBaseUrl] = useState(initial?.base_url ?? PROVIDERS[0].hint)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(initial?.model ?? '')
  const [error, setError] = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)

  const save = useMutation({
    // 编辑时 api_key 可缺省（后端跳过空值，不改动已存密钥）
    mutationFn: (data: ModelConfigUpdate & { name: string; provider: ProviderKind; base_url: string; model: string }) =>
      initial ? api.modelConfigs.update(initial.id, data) : api.modelConfigs.create(data as Parameters<typeof api.modelConfigs.create>[0]),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['model-configs'] })
      onDone()
    },
    onError: (e) => setError(errorMessage(e)),
  })

  const test = useMutation({
    mutationFn: async () => {
      if (initial && !apiKey) {
        // 已有配置：直接测现有（密钥不回流前端，后端用存量密钥）
        return api.modelConfigs.test(initial.id)
      }
      // 先保存再测，确保密钥入库存储
      const saved = initial
        ? await api.modelConfigs.update(initial.id, {
            name: name.trim(),
            provider,
            base_url: baseUrl.trim(),
            api_key: apiKey,
            model: model.trim(),
          })
        : await api.modelConfigs.create({
            name: name.trim(),
            provider,
            base_url: baseUrl.trim(),
            api_key: apiKey,
            model: model.trim(),
          })
      await queryClient.invalidateQueries({ queryKey: ['model-configs'] })
      return api.modelConfigs.test(saved.id)
    },
    onSuccess: (r) =>
      setTestResult({ ok: r.ok, text: r.ok ? `连接成功（首字延迟 ${r.latency_ms}ms）` : (r.error ?? '连接失败') }),
    onError: (e) => setTestResult({ ok: false, text: errorMessage(e) }),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!initial && !apiKey) {
      setError('API Key 为必填（只会加密保存在服务器）')
      return
    }
    save.mutate({
      name: name.trim(),
      provider,
      base_url: baseUrl.trim(),
      ...(apiKey ? { api_key: apiKey } : {}),
      model: model.trim(),
    })
  }

  return (
    <PixelCard className="w-full max-w-lg">
      <h2 className="font-pixel text-xs text-wbrown">{initial ? '编辑模型配置' : '新增模型配置'}</h2>
      <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit}>
        <PixelInput label="配置名称" value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} placeholder="例如：OpenAI 主力" />
        <label className="flex flex-col gap-1 text-sm font-semibold text-ink/80">
          服务商
          <select
            value={provider}
            onChange={(e) => {
              const p = e.target.value as ProviderKind
              setProvider(p)
              setBaseUrl(PROVIDERS.find((x) => x.value === p)?.hint ?? '')
            }}
            className="min-h-[44px] rounded border-2 border-ink/15 bg-cream px-3 py-2 text-base outline-none focus:border-sage-dark"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <PixelInput label="Base URL" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} required placeholder="https://…" />
        <PixelInput
          label={initial ? 'API Key（留空则不修改）' : 'API Key'}
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          required={!initial}
          placeholder="sk-…"
          autoComplete="off"
        />
        <PixelInput label="模型名" value={model} onChange={(e) => setModel(e.target.value)} required placeholder="gpt-4o-mini / claude-…" />

        {error && (
          <p role="alert" className="rounded border-2 border-pink-dark/40 bg-pink/20 px-3 py-2 text-sm text-pink-dark">
            {error}
          </p>
        )}
        {testResult && (
          <p
            role="status"
            className={[
              'rounded border-2 px-3 py-2 text-sm',
              testResult.ok ? 'border-sage-dark/40 bg-sage/20 text-sage-dark' : 'border-pink-dark/40 bg-pink/20 text-pink-dark',
            ].join(' ')}
          >
            {testResult.text}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <PixelButton type="submit" disabled={save.isPending || test.isPending} className="flex-1">
            {save.isPending ? '保存中…' : '保存'}
          </PixelButton>
          <PixelButton type="button" variant="outline" disabled={save.isPending || test.isPending} onClick={() => test.mutate()}>
            {test.isPending ? '测试中…' : '测试连接'}
          </PixelButton>
          <PixelButton type="button" variant="outline" onClick={onDone}>
            取消
          </PixelButton>
        </div>
      </form>
    </PixelCard>
  )
}

/** 设置：模型配置管理 + 账户注销。 */
export function SettingsPage() {
  const queryClient = useQueryClient()
  const { user, logout } = useAuth()
  const [editing, setEditing] = useState<ModelConfigOut | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [password, setPassword] = useState('')
  const [accountError, setAccountError] = useState('')

  const configs = useQuery({ queryKey: ['model-configs'], queryFn: () => api.modelConfigs.list() })
  const remove = useMutation({
    mutationFn: (id: string) => api.modelConfigs.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['model-configs'] }),
  })
  const deleteAccount = useMutation({
    mutationFn: () => api.auth.deleteAccount(password),
    onSuccess: () => {
      void logout()
      window.location.href = '/'
    },
    onError: (e) => setAccountError(errorMessage(e)),
  })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-pixel text-sm text-wbrown">设置</h1>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">模型配置</h2>
          <PixelButton onClick={() => setCreating(true)}>新增配置</PixelButton>
        </div>
        <p className="mt-1 text-xs text-ink/50">API Key 只在后端加密存储，永远不会返回给前端。</p>
        {configs.isLoading && <p className="mt-2 text-sm text-ink/50">加载中…</p>}
        {configs.error && <p className="mt-2 text-sm text-pink-dark">{errorMessage(configs.error)}</p>}
        <div className="mt-3 flex flex-col gap-2">
          {configs.data?.map((c) => (
            <PixelCard key={c.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold text-ink">
                  {c.name}
                  {c.is_default && <span className="ml-2 rounded bg-sage/30 px-2 py-0.5 text-xs text-sage-dark">默认</span>}
                </p>
                <p className="text-xs text-ink/50">
                  {c.provider} · {c.model} · {c.streaming ? '流式' : '非流式'} ·{' '}
                  {c.has_api_key ? '密钥已保存' : '未存密钥'}
                </p>
              </div>
              <div className="flex gap-2">
                <PixelButton variant="outline" className="min-h-[36px] px-3 py-1 text-sm" onClick={() => setEditing(c)}>
                  编辑
                </PixelButton>
                <PixelButton
                  variant="outline"
                  className="min-h-[36px] border-pink-dark/40 px-3 py-1 text-sm text-pink-dark"
                  onClick={() => remove.mutate(c.id)}
                >
                  删除
                </PixelButton>
              </div>
            </PixelCard>
          ))}
          {configs.data?.length === 0 && (
            <PixelCard className="p-4 text-center text-sm text-ink/50">
              还没有模型配置。添加后居民才能上线对话。
            </PixelCard>
          )}
        </div>
      </section>

      {(creating || editing) && (
        <ConfigForm
          initial={editing}
          onDone={() => {
            setCreating(false)
            setEditing(null)
          }}
        />
      )}

      <section>
        <h2 className="text-lg font-bold text-ink">账户</h2>
        <p className="mt-1 text-xs text-ink/50">
          当前登录：{user?.nickname}（{user?.email}）
        </p>
        <PixelButton variant="outline" className="mt-3 border-pink-dark/40 text-pink-dark" onClick={() => setConfirmDelete(true)}>
          注销账户
        </PixelButton>
        <p className="mt-1 text-xs text-ink/40">注销会删除你的居民、记忆、会话与全部数据。</p>
      </section>

      {confirmDelete && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 px-4" role="dialog" aria-modal="true">
          <PixelCard className="w-full max-w-sm">
            <p className="text-sm text-ink">注销后所有数据都会被清除且无法恢复。输入密码确认：</p>
            <PixelInput
              label="密码"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {accountError && <p className="mt-2 text-sm text-pink-dark">{accountError}</p>}
            <div className="mt-4 flex gap-3">
              <PixelButton
                className="flex-1 border-pink-dark bg-pink-dark"
                disabled={deleteAccount.isPending || !password}
                onClick={() => deleteAccount.mutate()}
              >
                {deleteAccount.isPending ? '注销中…' : '确认注销'}
              </PixelButton>
              <PixelButton variant="outline" onClick={() => setConfirmDelete(false)}>
                取消
              </PixelButton>
            </div>
          </PixelCard>
        </div>
      )}
    </div>
  )
}
