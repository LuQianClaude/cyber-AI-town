/** 场景 → React 的状态事件通道。处理器注入 game.registry。 */
import type Phaser from 'phaser'

export type StatusHandler = (message: string) => void

export function emitStatus(scene: Phaser.Scene, message: string): void {
  const handler = scene.registry.get('onStatus') as StatusHandler | undefined
  handler?.(message)
}
