import { test, expect } from '@playwright/test'

/**
 * M0 冒烟测试：着陆页可访问、无控制台错误。
 * 运行前需后端 (backend:dev) 与前端 (web dev) 均已启动。
 */
test('着陆页加载且无页面错误', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(String(err)))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('CYBER')
  expect(pageErrors).toEqual([])
})
