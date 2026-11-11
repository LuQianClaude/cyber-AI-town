/** 调试钩子：E2E 与排查用。仅在 config.debug 时安装。 */
import type Phaser from 'phaser'

export interface DebugState {
  scene: string
  x: number
  y: number
  facing: string
  npcs: Array<{ id: string; x: number; y: number }>
  /** 相机视野（世界坐标左上 + 缩放），用于世界坐标→屏幕坐标换算 */
  camera: { x: number; y: number; zoom: number } | null
}

export interface DebugApi {
  getState: () => DebugState
  teleport: (x: number, y: number) => void
}

export function installDebug(game: Phaser.Game, locate: () => { scene: string; player: Phaser.GameObjects.Sprite | null; facing: string; npcs?: Array<{ id: string; sprite: { x: number; y: number } }>; camera?: { x: number; y: number; zoom: number } | null } | null): DebugApi {
  const api: DebugApi = {
    getState: () => {
      const s = locate()
      return {
        scene: s?.scene ?? 'unknown',
        x: Math.round(s?.player?.x ?? -1),
        y: Math.round(s?.player?.y ?? -1),
        facing: s?.facing ?? 'down',
        npcs: (s?.npcs ?? []).map((n) => ({ id: n.id, x: Math.round(n.sprite.x), y: Math.round(n.sprite.y) })),
        camera: s?.camera ?? null,
      }
    },
    teleport: (x, y) => {
      const s = locate()
      if (s?.player) {
        s.player.x = x
        s.player.y = y
      }
    },
  }
  ;(window as unknown as Record<string, unknown>).__CYBER__ = api
  return api
}
