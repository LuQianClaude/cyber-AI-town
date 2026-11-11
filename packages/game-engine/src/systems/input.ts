/** 输入向量计算（纯函数，可单测）。场景层只负责采集按键/摇杆原始数据。 */

export interface InputVector {
  x: number
  y: number
}

export const KEY_BINDINGS: Record<string, keyof Omit<InputVector, never> | 'interact'> = {
  ArrowUp: 'y',
  KeyW: 'y',
  ArrowDown: 'y',
  KeyS: 'y',
  ArrowLeft: 'x',
  ArrowRight: 'x',
  KeyA: 'x',
  KeyD: 'x',
}

/** 由按键集合合成单位方向向量。 */
export function keyboardVector(pressed: ReadonlySet<string>): InputVector {
  let x = 0
  let y = 0
  if (pressed.has('ArrowLeft') || pressed.has('KeyA')) x -= 1
  if (pressed.has('ArrowRight') || pressed.has('KeyD')) x += 1
  if (pressed.has('ArrowUp') || pressed.has('KeyW')) y -= 1
  if (pressed.has('ArrowDown') || pressed.has('KeyS')) y += 1
  return normalize(x, y)
}

/** 摇杆：将拖拽位移限制在单位圆内，带死区。 */
export function joystickVector(dx: number, dy: number, deadZone = 10): InputVector {
  const len = Math.hypot(dx, dy)
  if (len < deadZone) return { x: 0, y: 0 }
  const scale = Math.min(len, 48) / 48
  return normalize(dx, dy, scale)
}

function normalize(x: number, y: number, scale = 1): InputVector {
  const len = Math.hypot(x, y)
  if (len === 0) return { x: 0, y: 0 }
  return { x: (x / len) * scale, y: (y / len) * scale }
}

/** 由速度向量推断朝向（像素坐标系，y 向下）。 */
export type Facing = 'down' | 'up' | 'left' | 'right'

export function facingFromVector(v: InputVector): Facing {
  if (v.x === 0 && v.y === 0) return 'down'
  if (Math.abs(v.x) > Math.abs(v.y)) return v.x > 0 ? 'right' : 'left'
  return v.y > 0 ? 'down' : 'up'
}
