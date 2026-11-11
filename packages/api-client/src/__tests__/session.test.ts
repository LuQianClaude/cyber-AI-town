import { describe, it, expect, vi, afterEach } from 'vitest'
import { ApiSession, createMemoryTokenStorage, ApiClientError } from '../index'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('ApiSession 自动刷新', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('401 时刷新令牌并重试原请求', async () => {
    const storage = createMemoryTokenStorage()
    storage.setTokens('expired-token', 'refresh-1')
    const session = new ApiSession(storage)
    const fetchMock = vi
      .fn()
      // 原请求 401
      .mockResolvedValueOnce(jsonResponse({ detail: '登录已过期，请重新登录' }, 401))
      // 刷新成功（返回轮转后的新令牌）
      .mockResolvedValueOnce(
        jsonResponse({ access_token: 'new-access', refresh_token: 'new-refresh', token_type: 'bearer' }),
      )
      // 重试成功
      .mockResolvedValueOnce(jsonResponse({ id: 'u1', nickname: '我' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = (await session.request('/auth/me')) as { nickname: string }
    expect(result.nickname).toBe('我')
    // 令牌已轮转
    expect(storage.getAccess()).toBe('new-access')
    expect(storage.getRefresh()).toBe('new-refresh')
    // 重试带了新令牌
    const retryHeaders = (fetchMock.mock.calls[2][1] as RequestInit).headers as Headers
    expect(retryHeaders.get('Authorization')).toBe('Bearer new-access')
  })

  it('刷新失败时清空令牌并抛出 401', async () => {
    const storage = createMemoryTokenStorage()
    storage.setTokens('expired', 'refresh-bad')
    const session = new ApiSession(storage)
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ detail: '登录已过期，请重新登录' }, 401))
        .mockResolvedValueOnce(jsonResponse({ detail: '登录已过期，请重新登录' }, 401)),
    )
    await expect(session.request('/auth/me')).rejects.toMatchObject({ status: 401 })
    expect(storage.getAccess()).toBeNull()
  })

  it('无刷新令牌时 401 直接抛出', async () => {
    const session = new ApiSession(createMemoryTokenStorage())
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ detail: '未登录' }, 401)))
    await expect(session.request('/residents')).rejects.toBeInstanceOf(ApiClientError)
  })
})
