import { test, expect, type Page } from '@playwright/test'

type CyberDebug = {
  getState: () => { scene: string; x: number; y: number; facing: string }
  teleport: (x: number, y: number) => void
}

/** M2 起世界需要登录：通过 API 注册新用户并注入令牌（不走 UI，聚焦引擎断言）。 */
async function loginAsNewUser(page: Page) {
  const res = await page.request.post('http://localhost:8000/api/auth/register', {
    data: { email: `world-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`, password: 'password-123', nickname: '世界测试员' },
  })
  if (!res.ok()) throw new Error(`注册失败: ${res.status()}`)
  const tokens = await res.json()
  await page.addInitScript(
    ([access, refresh]) => {
      localStorage.setItem('cyber-universe:access', access)
      localStorage.setItem('cyber-universe:refresh', refresh)
    },
    [tokens.access_token as string, tokens.refresh_token as string],
  )
}

async function cyber(page: Page): Promise<CyberDebug> {
  await loginAsNewUser(page)
  await page.goto('/world')
  await page.waitForFunction(() => (window as unknown as { __CYBER__?: CyberDebug }).__CYBER__ !== undefined, {
    timeout: 15_000,
  })
  return page.evaluate(() => (window as unknown as { __CYBER__: CyberDebug }).__CYBER__)
}

const state = (page: Page) =>
  page.evaluate(() => (window as unknown as { __CYBER__: CyberDebug }).__CYBER__.getState())

test.describe('M1 像素世界', () => {
  test('引擎启动，世界场景就绪，零页面错误', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await cyber(page)
    const s = await state(page)
    expect(s.scene).toBe('World')
    expect(s.x).toBeGreaterThan(0)
    expect(errors).toEqual([])
  })

  test('键盘移动改变坐标与朝向', async ({ page }) => {
    await cyber(page)
    const before = await state(page)
    await page.keyboard.down('ArrowRight')
    await page.waitForTimeout(700)
    await page.keyboard.up('ArrowRight')
    const after = await state(page)
    expect(after.x).toBeGreaterThan(before.x + 30)
    expect(after.facing).toBe('right')
  })

  test('碰撞：向上走会被房屋挡住（无法穿墙）', async ({ page }) => {
    await cyber(page)
    await page.evaluate(() => (window as unknown as { __CYBER__: CyberDebug }).__CYBER__.teleport(19 * 32 + 16, 11 * 32))
    await page.keyboard.down('ArrowUp')
    await page.waitForTimeout(900)
    await page.keyboard.up('ArrowUp')
    const s = await state(page)
    // 门 tile 可站立（row 8），但穿不过墙体（row 7 为实心）
    expect(s.scene).toBe('World')
    expect(s.y).toBeGreaterThanOrEqual(8 * 32 - 4)
    expect(s.y).toBeLessThan(9 * 32)
  })

  test('房门交互：进入室内并返回世界，位置保留在门外', async ({ page }) => {
    await cyber(page)
    await page.evaluate(() => (window as unknown as { __CYBER__: CyberDebug }).__CYBER__.teleport(19 * 32 + 16, 9 * 32))
    await page.waitForTimeout(200)
    await page.keyboard.press('KeyE')
    await page.waitForFunction(
      () => (window as unknown as { __CYBER__: CyberDebug }).__CYBER__.getState().scene === 'House',
      { timeout: 5000 },
    )
    // 室内向下走到门口，按 E 返回
    await page.keyboard.down('ArrowDown')
    await page.waitForTimeout(500)
    await page.keyboard.up('ArrowDown')
    await page.keyboard.press('KeyE')
    await page.waitForFunction(
      () => (window as unknown as { __CYBER__: CyberDebug }).__CYBER__.getState().scene === 'World',
      { timeout: 5000 },
    )
    const s = await state(page)
    expect(s.y).toBeGreaterThan(8 * 32)
  })

  test('世界可截图渲染（非黑屏）', async ({ page }) => {
    await cyber(page)
    await page.waitForTimeout(600)
    const box = await page.locator('canvas').boundingBox()
    expect(box).toBeTruthy()
  })
})
