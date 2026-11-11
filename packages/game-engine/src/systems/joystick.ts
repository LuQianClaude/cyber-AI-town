/** 虚拟摇杆：触控拖拽产生移动向量，渲染为基座 + 摇帽。 */
import type Phaser from 'phaser'

import { joystickVector, type InputVector } from './input'

export interface Joystick {
  vector: () => InputVector
  active: () => boolean
  destroy: () => void
}

export function makeJoystick(scene: Phaser.Scene): Joystick {
  const g = scene.add.graphics().setDepth(9999).setVisible(false)
  const state = { pointerId: -1, baseX: 0, baseY: 0, dx: 0, dy: 0, active: false }

  const KNOB_R = 22
  const BASE_R = 48

  const render = () => {
    g.clear()
    if (!state.active) return
    g.fillStyle(0x2e2a26, 0.25)
    g.fillCircle(state.baseX, state.baseY, BASE_R)
    g.lineStyle(2, 0x7a5c45, 0.6)
    g.strokeCircle(state.baseX, state.baseY, BASE_R)
    g.fillStyle(0x7a5c45, 0.75)
    g.fillCircle(state.baseX + state.dx, state.baseY + state.dy, KNOB_R)
  }

  const inZone = (p: Phaser.Input.Pointer) => p.x < scene.scale.width * 0.55 && p.y > scene.scale.height * 0.35

  scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
    if (state.active || !inZone(p)) return
    state.pointerId = p.id
    state.baseX = p.x
    state.baseY = p.y
    state.dx = 0
    state.dy = 0
    state.active = true
    g.setVisible(true)
    render()
  })
  scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
    if (!state.active || p.id !== state.pointerId) return
    state.dx = p.x - state.baseX
    state.dy = p.y - state.baseY
    render()
  })
  const release = (p: Phaser.Input.Pointer) => {
    if (!state.active || p.id !== state.pointerId) return
    state.active = false
    state.dx = 0
    state.dy = 0
    g.setVisible(false)
    render()
  }
  scene.input.on('pointerup', release)
  scene.input.on('pointerupoutside', release)

  return {
    vector: () => joystickVector(state.dx, state.dy),
    active: () => state.active,
    destroy: () => g.destroy(),
  }
}

/** 右下互动按钮（触控场景替代键盘 E）。 */
export function makeInteractButton(scene: Phaser.Scene, onPress: () => void): Phaser.GameObjects.Container {
  const x = scene.scale.width - 72
  const y = scene.scale.height - 84
  const circle = scene.add.circle(x, y, 34, 0x7a5c45, 0.9).setScrollFactor(0).setInteractive({ useHandCursor: true })
  const label = scene.add.text(x, y, '互动', { fontFamily: '600 14px Nunito, sans-serif', color: '#FAF6EF' }).setOrigin(0.5).setScrollFactor(0)
  circle.setStrokeStyle(2, 0x54402f)
  circle.on('pointerdown', onPress)
  return scene.add.container(0, 0, [circle, label]).setDepth(10001)
}
