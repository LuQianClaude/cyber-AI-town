import { describe, it, expect, vi } from 'vitest'

/**
 * jsdom 无 canvas 实现，Phaser 设备检测会在导入期崩溃，故 mock phaser。
 * 纯逻辑层（布局 / 输入 / 角色配色）直接测源码；渲染层由 Playwright E2E 承担。
 */
vi.mock('phaser', () => ({
  default: {
    AUTO: 0,
    Scale: { RESIZE: 0, CENTER_BOTH: 0 },
    Scene: class MockScene {
      constructor(public readonly key: string) {}
    },
    Game: class MockGame {},
  },
}))

const layout = await import('../world/layout')
const input = await import('../systems/input')
const character = await import('../render/character')
const index = await import('../index')

describe('世界布局', () => {
  const world = layout.buildWorldLayout()

  it('网格尺寸正确且被水环绕', () => {
    expect(world.cols).toBe(40)
    expect(world.rows).toBe(28)
    expect(world.grid[0][0]).toBe('~')
    expect(world.grid[27][39]).toBe('~')
    expect(world.grid[14][20]).not.toBe('~')
  })

  it('房屋主体实心、门可通行', () => {
    expect(layout.isSolid(world.grid[4][16])).toBe(true)
    expect(layout.isSolid(world.grid[8][19])).toBe(false)
  })

  it('种植区与栅栏存在', () => {
    expect(world.grid[12][28]).toBe('.')
    expect(world.grid[10][26]).toBe('n')
    expect(world.grid[14][26]).toBe('p') // 花园门
  })

  it('越界坐标视为实心（防走出世界）', () => {
    expect(layout.isSolidAt(world, -10, 100)).toBe(true)
    expect(layout.isSolidAt(world, 100000, 100)).toBe(true)
  })

  it('出生点不在实心地块上', () => {
    expect(layout.isSolidAt(world, world.spawn.x, world.spawn.y)).toBe(false)
  })

  it('交互区包含房门与全部种植地块', () => {
    const actions = world.zones.map((z) => z.action)
    expect(actions).toContain('enter-house')
    expect(actions.filter((a) => a === 'plot')).toHaveLength(12)
  })
})

describe('输入向量', () => {
  it('键盘斜向移动归一化', () => {
    const v = input.keyboardVector(new Set(['ArrowRight', 'ArrowDown']))
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1)
    expect(v.x).toBeGreaterThan(0)
    expect(v.y).toBeGreaterThan(0)
  })

  it('摇杆死区内为零', () => {
    expect(input.joystickVector(3, 4)).toEqual({ x: 0, y: 0 })
  })

  it('摇杆方向正确', () => {
    const v = input.joystickVector(-48, 0)
    expect(v.x).toBeCloseTo(-1)
  })

  it('朝向判定', () => {
    expect(input.facingFromVector({ x: 0, y: 0 })).toBe('down')
    expect(input.facingFromVector({ x: 1, y: 0 })).toBe('right')
    expect(input.facingFromVector({ x: 0, y: -1 })).toBe('up')
    expect(input.facingFromVector({ x: -3, y: 1 })).toBe('left')
  })
})

describe('角色规格', () => {
  it('默认皮肤取自画风参考（黑发黑瞳米白裙）', () => {
    const spec = character.resolveSpec()
    expect(spec.colors.hair).toBe('#26262C')
    expect(spec.longHair).toBe(true)
  })

  it('配色可配置且长发可选', () => {
    const spec = character.resolveSpec({ hair: '#8B4513', eyes: '#2F6F8F', longHair: false })
    expect(spec.colors.hair).toBe('#8B4513')
    expect(spec.colors.skin).toBe(character.DEFAULT_SPEC.colors.skin)
    expect(spec.longHair).toBe(false)
  })
})

describe('引擎入口', () => {
  it('缺失挂载节点抛出可读错误', () => {
    expect(() => index.createGame({ parent: 'not-exist-node' })).toThrow(/找不到挂载节点/)
  })
})
