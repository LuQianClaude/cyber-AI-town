import { describe, it, expect, vi, afterEach } from 'vitest'
import { getHealth, ApiClientError } from '../index'

describe('api-client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('getHealth 解析正常响应', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok', version: '0.1.0', time: '2026-11-08T00:00:00Z' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    const health = await getHealth()
    expect(health.status).toBe('ok')
  })

  it('getHealth 将错误响应转为 ApiClientError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: 'Not Found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    await expect(getHealth()).rejects.toMatchObject({ status: 404, message: 'Not Found' })
    await expect(getHealth()).rejects.toBeInstanceOf(ApiClientError)
  })

  it('网络失败抛出 status=0 的错误', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    await expect(getHealth()).rejects.toMatchObject({ status: 0 })
  })
})
