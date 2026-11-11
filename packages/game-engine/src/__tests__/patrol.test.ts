import { describe, expect, it } from 'vitest'

import {
  createPatrolState,
  nextPatrolTarget,
  stepPatrol,
  PATROL_PAUSE_MAX,
  PATROL_PAUSE_MIN,
  PATROL_RADIUS,
  PATROL_SPEED,
  type Vec2,
} from '../systems/patrol'

/** 确定性 rng 序列生成器 */
function seq(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

const HOME: Vec2 = { x: 400, y: 300 }
const NO_SOLID = () => false

describe('NPC 巡逻', () => {
  it('初始为停留态，停留时长在区间内', () => {
    const s = createPatrolState(seq([0.5]))
    expect(s.mode).toBe('pause')
    expect(s.timer).toBeGreaterThanOrEqual(PATROL_PAUSE_MIN)
    expect(s.timer).toBeLessThanOrEqual(PATROL_PAUSE_MAX)
    expect(s.target).toBeNull()
  })

  it('目标点不超出游走半径，碰撞时重试，最终可退回出生点', () => {
    // angle=0 → cos=1, dist 取到最大半径
    const t = nextPatrolTarget(HOME, seq([0, 1]), NO_SOLID)
    expect(Math.hypot(t.x - HOME.x, t.y - HOME.y)).toBeLessThanOrEqual(PATROL_RADIUS)
    // 全部碰撞 → 退回出生点
    const fallback = nextPatrolTarget(HOME, seq([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]), () => true)
    expect(fallback).toEqual(HOME)
  })

  it('停留计时耗尽后进入行走态并选定目标', () => {
    const s = createPatrolState(seq([0]))
    s.timer = 0.5
    const pos = stepPatrol(s, 1, HOME, HOME, seq([0.25, 0.5]), NO_SOLID)
    expect(s.mode).toBe('walk')
    expect(s.target).not.toBeNull()
    expect(pos).toEqual(HOME) // 出发当帧不移动
  })

  it('行走按速度推进，到达后转停留并重置计时', () => {
    const s = createPatrolState(seq([0]))
    s.mode = 'walk'
    s.target = { x: HOME.x + PATROL_SPEED * 0.5, y: HOME.y } // 0.5 秒路程
    const mid = stepPatrol(s, 0.25, HOME, HOME, seq([0]), NO_SOLID)
    expect(mid.x).toBeCloseTo(HOME.x + PATROL_SPEED * 0.25)
    expect(mid.y).toBeCloseTo(HOME.y)
    expect(s.mode).toBe('walk')
    const arrived = stepPatrol(s, 0.25, mid, HOME, seq([1]), NO_SOLID)
    expect(arrived.x).toBeCloseTo(s.target!.x)
    expect(s.mode).toBe('pause')
    expect(s.target).toBeNull()
    expect(s.timer).toBe(PATROL_PAUSE_MAX) // rng=1 → 上限
  })

  it('原地对象不被改动', () => {
    const s = createPatrolState(seq([0]))
    s.mode = 'walk'
    s.target = { x: HOME.x + 100, y: HOME.y }
    const before = { ...HOME }
    stepPatrol(s, 0.016, HOME, HOME, seq([0]), NO_SOLID)
    expect(HOME).toEqual(before)
  })
})
