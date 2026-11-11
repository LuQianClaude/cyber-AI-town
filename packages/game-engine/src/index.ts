/**
 * @cyber-universe/game-engine v0.2.0 (M1)
 * Phaser 3 像素世界引擎。独立 Game Loop，不依赖 React 渲染周期。
 * 只通过 api-client 消费世界状态，绝不直接调用大模型 API。
 */
import Phaser from 'phaser'

import type { EngineConfig } from './config'
import { DEFAULT_CHARACTER } from './config'
import { installDebug } from './debug'
import { WorldScene } from './scenes/WorldScene'
import { HouseScene } from './scenes/HouseScene'

export const ENGINE_VERSION = '0.2.0' as const
export const PIXEL_SCALE = 3

export * from './config'
export * from './palettes'
export * from './world/layout'
export * from './systems/input'
export * from './systems/patrol'
export * from './render/character'
export type { Hud } from './ui/hud'

export interface GameHandle {
  game: Phaser.Game
  destroy: () => void
}

/**
 * 创建世界。React 侧在 useEffect 中调用，卸载时调用 handle.destroy()。
 */
export function createGame(config: EngineConfig): GameHandle {
  const parent = typeof config.parent === 'string' ? document.getElementById(config.parent) : config.parent
  if (!parent) throw new Error(`[game-engine] 找不到挂载节点: ${String(config.parent)}`)

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#FAF6EF',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, width: parent.clientWidth || 960, height: parent.clientHeight || 540 },
    scene: [WorldScene, HouseScene],
    callbacks: {
      preBoot: (g) => {
        g.registry.set('playerConfig', { ...DEFAULT_CHARACTER, ...config.player })
        g.registry.set('npcs', config.npcs ?? [])
        g.registry.set('onNpcInteract', config.onNpcInteract ?? null)
        g.registry.set('onStatus', config.onStatus ?? null)
        g.registry.set('onReady', config.onReady ?? null)
      },
    },
  })

  const handle: GameHandle = {
    game,
    destroy: () => game.destroy(true),
  }

  if (config.debug) {
    installDebug(game, () => {
      const active = game.scene.isActive('World') ? game.scene.getScene('World') : game.scene.getScene('House')
      const player = (active as { player?: Phaser.GameObjects.Sprite | null } | null)?.player ?? null
      const facing = (active as { facing?: string } | null)?.facing ?? 'down'
      const npcs = (active as { npcs?: Array<{ id: string; sprite: { x: number; y: number } }> } | null)?.npcs ?? []
      const cam = active?.cameras.main
      return {
        scene: active?.scene.key ?? 'none',
        player,
        facing,
        npcs: npcs.map((n) => ({ id: n.id, sprite: { x: n.sprite.x, y: n.sprite.y } })),
        camera: cam ? { x: cam.worldView.x, y: cam.worldView.y, zoom: cam.zoom } : null,
      }
    })
  }

  return handle
}

export { Phaser }
