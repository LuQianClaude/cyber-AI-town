import { describe, it, expect } from 'vitest'
import { APP_NAME, API_VERSION, ROUTES, type HealthResponse } from '../index'

describe('shared 常量与类型', () => {
  it('导出应用元信息', () => {
    expect(APP_NAME).toBe('Cyber Universe')
    expect(API_VERSION).toBe('v1')
  })

  it('主页面路由完整（10 个业务路由）', () => {
    expect(ROUTES).toHaveLength(10)
    expect(ROUTES).toContain('/garden')
    expect(ROUTES).toContain('/settings')
  })

  it('HealthResponse 类型可赋值', () => {
    const res: HealthResponse = { status: 'ok', version: '0.1.0', time: new Date().toISOString() }
    expect(res.status).toBe('ok')
  })
})
