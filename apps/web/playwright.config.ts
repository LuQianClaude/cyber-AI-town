import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    // M2 全链路 mock LLM（OpenAI 兼容 SSE）
    {
      command: 'node e2e/mock-llm.mjs',
      url: 'http://127.0.0.1:8377',
      reuseExistingServer: true,
      timeout: 15_000,
    },
    // 后端（独立 E2E 数据库，开发环境自动建表；开发环境放行私网 Provider 地址以指向 mock）
    {
      command:
        'cd ../../backend && rm -f e2e-test.db && CYBER_DATABASE_URL=sqlite:///./e2e-test.db CYBER_ENV=development CYBER_SECRET_KEY=e2e-secret-key-not-for-production PYTHONPATH=.deps:. python3 -m uvicorn app.main:app --port 8000',
      url: 'http://localhost:8000/api/health',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
})
