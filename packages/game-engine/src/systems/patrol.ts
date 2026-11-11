// © 2026 Landric · Cyber Universe — 原创代码，未经授权禁止盗用、抄袭
/** NPC 自主巡逻（M3 行为引擎）：围绕出生点随机游走。
 * 纯逻辑、不依赖 Phaser；rng 与碰撞检测均可注入，保证单测确定性。
 */

export interface Vec2 {
  x: number
  y: number
}

export type PatrolMode = 'pause' | 'walk'

export interface PatrolState {
  mode: PatrolMode
  target: Vec2 | null
  /** pause 模式下的剩余停留时间（秒） */
  timer: number
}

export const PATROL_RADIUS = 96
export const PATROL_SPEED = 42 // px/s
export const PATROL_PAUSE_MIN = 2 // 秒
export const PATROL_PAUSE_MAX = 5 // 秒

export function createPatrolState(rng: () => number = Math.random): PatrolState {
  // 初始随机停留，错开各 NPC 的出发时间
  return {
    mode: 'pause',
    target: null,
    timer: PATROL_PAUSE_MIN + rng() * (PATROL_PAUSE_MAX - PATROL_PAUSE_MIN),
  }
}

/** 在出生点附近随机取一个非碰撞目标点；重试 8 次后退回出生点。 */
export function nextPatrolTarget(
  home: Vec2,
  rng: () => number,
  isSolid: (x: number, y: number) => boolean,
): Vec2 {
  for (let i = 0; i < 8; i++) {
    const angle = rng() * Math.PI * 2
    const dist = 24 + rng() * (PATROL_RADIUS - 24)
    const x = home.x + Math.cos(angle) * dist
    const y = home.y + Math.sin(angle) * dist
    if (!isSolid(x, y)) return { x, y }
  }
  return { ...home }
}

/** 推进巡逻状态一帧，返回新位置（原地对象不改动）。 */
export function stepPatrol(
  state: PatrolState,
  dt: number,
  pos: Vec2,
  home: Vec2,
  rng: () => number,
  isSolid: (x: number, y: number) => boolean,
): Vec2 {
  if (state.mode === 'pause') {
    state.timer -= dt
    if (state.timer <= 0) {
      state.target = nextPatrolTarget(home, rng, isSolid)
      state.mode = 'walk'
    }
    return pos
  }
  const target = state.target
  if (!target) {
    state.mode = 'pause'
    state.timer = PATROL_PAUSE_MIN
    return pos
  }
  const dx = target.x - pos.x
  const dy = target.y - pos.y
  const dist = Math.hypot(dx, dy)
  const step = PATROL_SPEED * dt
  if (dist <= step) {
    state.mode = 'pause'
    state.target = null
    state.timer = PATROL_PAUSE_MIN + rng() * (PATROL_PAUSE_MAX - PATROL_PAUSE_MIN)
    return { ...target }
  }
  return { x: pos.x + (dx / dist) * step, y: pos.y + (dy / dist) * step }
}
