/** 场景内 HUD：底部互动提示 + 状态浮层。固定于镜头（不随世界滚动）。 */
import type Phaser from 'phaser'

import { PALETTE } from '../palettes'

export interface Hud {
  prompt: (text: string | null) => void
  toast: (text: string, ms?: number) => void
  /** 视口尺寸变化时重定位 */
  reposition: () => void
  destroy: () => void
}

const FONT = '600 13px Nunito, system-ui, sans-serif'

function panel(scene: Phaser.Scene, y: number): Phaser.GameObjects.Container {
  const w = scene.scale.width
  const bg = scene.add.rectangle(w / 2, y, 10, 34, 0x2e2a26, 0.85).setScrollFactor(0)
  const label = scene.add.text(w / 2, y, '', { fontFamily: FONT, color: PALETTE.cream }).setOrigin(0.5).setScrollFactor(0)
  const c = scene.add.container(0, 0, [bg, label]).setDepth(10000)
  bg.setStrokeStyle(2, 0x7a5c45)
  return c
}

export function makeHud(scene: Phaser.Scene): Hud {
  const promptBox = panel(scene, scene.scale.height - 56)
  const toastBox = panel(scene, 64)
  const promptBg = promptBox.list[0] as Phaser.GameObjects.Rectangle
  const promptLabel = promptBox.list[1] as Phaser.GameObjects.Text
  const toastBg = toastBox.list[0] as Phaser.GameObjects.Rectangle
  const toastLabel = toastBox.list[1] as Phaser.GameObjects.Text

  promptBox.setVisible(false)
  toastBox.setVisible(false)

  const fit = (bg: Phaser.GameObjects.Rectangle, label: Phaser.GameObjects.Text) => {
    bg.width = label.width + 28
    bg.x = scene.scale.width / 2
    label.x = bg.x
  }

  let toastTimer: Phaser.Time.TimerEvent | null = null

  return {
    prompt: (text) => {
      if (!text) {
        promptBox.setVisible(false)
        return
      }
      promptLabel.setText(text)
      fit(promptBg, promptLabel)
      promptBox.setVisible(true)
    },
    toast: (text, ms = 2200) => {
      toastLabel.setText(text)
      fit(toastBg, toastLabel)
      toastBox.setVisible(true)
      toastBox.setAlpha(1)
      toastTimer?.remove(false)
      toastTimer = scene.time.delayedCall(ms, () => {
        scene.tweens.add({ targets: toastBox, alpha: 0, duration: 300, onComplete: () => toastBox.setVisible(false) })
      })
    },
    reposition: () => {
      promptBg.x = scene.scale.width / 2
      promptLabel.x = promptBg.x
      promptBg.y = scene.scale.height - 56
      promptLabel.y = promptBg.y
      toastBg.x = scene.scale.width / 2
      toastLabel.x = toastBg.x
      fit(promptBg, promptLabel)
      fit(toastBg, toastLabel)
    },
    destroy: () => {
      toastTimer?.remove(false)
      promptBox.destroy(true)
      toastBox.destroy(true)
    },
  }
}
