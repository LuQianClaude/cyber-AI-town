/** 前端环境配置。仅允许 VITE_ 前缀变量进入浏览器代码。 */
export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? '/api',
  wsUrl: import.meta.env.VITE_WS_URL ?? '/ws',
} as const
