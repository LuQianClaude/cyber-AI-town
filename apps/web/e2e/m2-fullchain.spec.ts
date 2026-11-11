import { expect, test, type Page } from '@playwright/test'

/**
 * M2 全链路 E2E（真实后端 + mock LLM）：
 * 注册 → 新增模型配置 → 测试连接 → 创造居民 → 世界中出现 NPC →
 * 走近互动进入聊天 → 流式回复落库。
 */

const EMAIL = `e2e-${Date.now()}@example.com`
const PASSWORD = 'e2e-password-123'
const NICKNAME = 'E2E 玩家'
const RESIDENT_NAME = '小满'

async function register(page: Page) {
  await page.goto('/login')
  await page.getByRole('tab', { name: '注册' }).click()
  await page.getByLabel('昵称').fill(NICKNAME)
  await page.getByLabel('邮箱').fill(EMAIL)
  await page.getByLabel('密码').fill(PASSWORD)
  await page.getByRole('button', { name: '创建账户' }).click()
  await expect(page).toHaveURL(/\/home/)
}

async function createModelConfig(page: Page) {
  await page.goto('/settings')
  await page.getByRole('button', { name: '新增配置' }).click()
  await page.getByLabel('配置名称').fill('E2E Mock')
  await page.getByLabel('Base URL').fill('http://127.0.0.1:8377/v1')
  await page.getByLabel('API Key').fill('sk-e2e-mock')
  await page.getByLabel('模型名').fill('mock-model')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText('E2E Mock')).toBeVisible()
}

async function createResident(page: Page) {
  await page.goto('/residents')
  await page.getByRole('button', { name: '创造居民' }).click()
  await page.getByLabel('昵称').fill(RESIDENT_NAME)
  // 选择刚创建的模型配置（让居民上线）
  await page.getByLabel('模型配置').selectOption({ label: 'E2E Mock · openai/mock-model' })
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText(RESIDENT_NAME)).toBeVisible()
}

test('M2 全链路：注册到流式聊天', async ({ page }) => {
  await register(page)
  await createModelConfig(page)
  await createResident(page)

  // 世界里出现居民 NPC（Phaser 绘制在 canvas 内，通过调试 API 断言）
  await page.goto('/world')
  await expect(page.getByText('CYBER UNIVERSE · 世界')).toBeVisible()
  const npc = await page.waitForFunction(() => {
    const state = (window as any).__CYBER__?.getState?.()
    return state?.npcs?.length ? state : null
  })
  const state = await npc.jsonValue()
  expect(state.npcs.length).toBeGreaterThan(0)
  const target = state.npcs[0]
  await page.evaluate(({ x, y }) => (window as any).__CYBER__.teleport(x, y + 40), target)
  await page.keyboard.press('KeyE')
  await expect(page).toHaveURL(/\/chat\?with=/, { timeout: 15_000 })

  // 连接后发送消息，验证流式回复
  await expect(page.getByText('已连接')).toBeVisible({ timeout: 15_000 })
  await page.getByLabel('消息输入框').fill('你好呀')
  await page.getByRole('button', { name: '发送' }).click()
  await expect(page.getByText('你好呀，我是测试居民，很高兴认识你！')).toBeVisible({ timeout: 30_000 })

  // 会话出现在列表里（持久化验证）
  await expect(page.getByRole('button', { name: new RegExp(RESIDENT_NAME) }).first()).toBeVisible()
})
