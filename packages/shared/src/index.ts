/**
 * @cyber-universe/shared
 * 前后端共享数据契约的唯一前端来源。
 * 后端以 Pydantic Schema 为权威定义，通过 OpenAPI 校验（见 DEVELOPMENT.md
 * "数据契约"一节），本包仅存放纯前端使用的领域类型与常量，
 * 禁止在多个包中重复定义同一业务类型。
 */

export const APP_NAME = 'Cyber Universe'
export const API_VERSION = 'v1'

/** 后端 /api/health 响应。字段与 backend/app/schemas/health.py 保持一致。 */
export interface HealthResponse {
  status: 'ok'
  version: string
  time: string
}

/** 统一的 API 错误负载。 */
export interface ApiErrorBody {
  detail: string
}

/** 12 个主页面路由（M0 仅注册路由，页面在对应里程碑实现）。 */
export const ROUTES = [
  '/world',
  '/home',
  '/family',
  '/residents',
  '/chat',
  '/mailbox',
  '/memories',
  '/garden',
  '/town',
  '/settings',
] as const
export type AppRoute = (typeof ROUTES)[number]
