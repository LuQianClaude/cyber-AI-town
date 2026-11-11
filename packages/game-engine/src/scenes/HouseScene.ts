/** 房屋室内场景：与外部通过门双向切换，返回时保留门外位置。 */
import Phaser from 'phaser'

import { CAMERA_ZOOM, TILE_SIZE } from '../config'
import {
  makeCharacter,
  CHAR_TEXTURE,
  walkAnimationFrames,
  idleFrame,
  type DirectionName,
  resolveSpec,
} from '../render/character'
import { makeInterior } from '../render/structures'
import { facingFromVector, keyboardVector } from '../systems/input'
import { makeJoystick, makeInteractButton } from '../systems/joystick'
import { makeHud, type Hud } from '../ui/hud'

const COLS = 20
const ROWS = 14

const FURNITURE: Array<{ key: string; col: number; row: number; w: number; h: number; solid?: boolean }> = [
  { key: 'bed', col: 1, row: 1, w: 3, h: 2, solid: true },
  { key: 'shelf', col: 16, row: 1, w: 2, h: 2.5, solid: true },
  { key: 'table', col: 9, row: 6, w: 2, h: 1.5, solid: true },
  { key: 'plant', col: 18, row: 11, w: 1, h: 1.5, solid: true },
  { key: 'plant', col: 1, row: 11, w: 1, h: 1.5, solid: true },
  { key: 'rug', col: 8, row: 7.4, w: 3, h: 2, solid: false },
]

/** 室内碰撞：墙体 + 家具 AABB。 */
const furnitureBoxes: Array<{ x1: number; y1: number; x2: number; y2: number }> = []

function buildCollision(): void {
  furnitureBoxes.length = 0
  for (const f of FURNITURE) {
    if (!f.solid) continue
    furnitureBoxes.push({
      x1: f.col * TILE_SIZE,
      y1: f.row * TILE_SIZE,
      x2: (f.col + f.w) * TILE_SIZE,
      y2: (f.row + f.h) * TILE_SIZE,
    })
  }
}

function indoorSolid(x: number, y: number): boolean {
  if (x < TILE_SIZE || y < TILE_SIZE || x > (COLS - 1) * TILE_SIZE || y > (ROWS - 1) * TILE_SIZE) return true
  for (const b of furnitureBoxes) {
    if (x > b.x1 && x < b.x2 && y > b.y1 && y < b.y2) return true
  }
  return false
}

export class HouseScene extends Phaser.Scene {
  player!: Phaser.GameObjects.Sprite
  private pressed = new Set<string>()
  facing: DirectionName = 'up'
  private joystick!: ReturnType<typeof makeJoystick>
  private hud!: Hud
  private exitPos = { x: 10 * TILE_SIZE, y: 12 * TILE_SIZE }
  private nearExit = false

  constructor() {
    super('House')
  }

  create(data: { returnX?: number; returnY?: number }): void {
    buildCollision()
    makeInterior(this)
    makeCharacter(this, resolveSpec(this.registry.get('playerConfig')))
    for (const dir of ['down', 'up', 'left', 'right'] as DirectionName[]) {
      this.anims.create({ key: `walk-${dir}`, frames: walkAnimationFrames(dir), frameRate: 8, repeat: -1 })
    }

    // 地板与墙
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const isWall = row === 0 || col === 0 || row === ROWS - 1 || col === COLS - 1
        this.add
          .image(col * TILE_SIZE + 16, row * TILE_SIZE + 16, isWall ? 'wall' : 'floor')
          .setDepth(isWall ? 500 : 0)
      }
    }

    // 家具（地毯在下层）
    for (const f of FURNITURE) {
      const depth = f.solid ? (f.row + f.h) * TILE_SIZE : 10
      this.add.image(f.col * TILE_SIZE, f.row * TILE_SIZE, f.key).setOrigin(0, 0).setDepth(depth)
    }
    // 门（下墙中央）
    const doorX = 10 * TILE_SIZE
    this.add.rectangle(doorX + 16, (ROWS - 1) * TILE_SIZE + 16, 28, 30, 0x54402f).setDepth(600)
    this.add.rectangle(doorX + 16, (ROWS - 1) * TILE_SIZE + 16, 24, 26, 0x7a5c45).setDepth(601)

    this.player = this.add.sprite(10 * TILE_SIZE, 11 * TILE_SIZE, CHAR_TEXTURE, 'up-0').setDepth(400)
    this.facing = 'up'

    const cam = this.cameras.main
    cam.setBounds(0, 0, COLS * TILE_SIZE, ROWS * TILE_SIZE)
    cam.setZoom(CAMERA_ZOOM)
    cam.startFollow(this.player, true, 0.12, 0.12)

    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      this.pressed.add(e.code)
      if (e.code === 'KeyE') this.tryInteract()
    })
    this.input.keyboard!.on('keyup', (e: KeyboardEvent) => this.pressed.delete(e.code))
    this.joystick = makeJoystick(this)
    makeInteractButton(this, () => this.tryInteract())

    this.hud = makeHud(this)
    this.scale.on('resize', this.hud.reposition)

    // 供退出时返回门外
    this.registry.set('returnPos', { x: data.returnX, y: data.returnY })
  }

  private tryInteract(): void {
    if (!this.nearExit) return
    const ret = this.registry.get('returnPos') as { x?: number; y?: number } | undefined
    this.cameras.main.fadeOut(220, 46, 42, 38)
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('World', { fromHouse: true, x: ret?.x, y: ret?.y })
    })
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05)
    const kb = keyboardVector(this.pressed)
    const v = kb.x !== 0 || kb.y !== 0 ? kb : this.joystick.vector()

    const dx = v.x * 96 * dt
    const dy = v.y * 96 * dt
    const hw = 6
    const box = { top: 2, bottom: 15 }
    if (dx !== 0 || dy !== 0) {
      const solidAt = (x: number, y: number) =>
        indoorSolid(x - hw, y + box.top) ||
        indoorSolid(x + hw, y + box.top) ||
        indoorSolid(x - hw, y + box.bottom) ||
        indoorSolid(x + hw, y + box.bottom)
      if (!solidAt(this.player.x + dx, this.player.y)) this.player.x += dx
      if (!solidAt(this.player.x, this.player.y + dy)) this.player.y += dy
      this.facing = facingFromVector(v)
      this.player.play(`walk-${this.facing}`, true)
    } else {
      this.player.stop()
      this.player.setFrame(idleFrame(this.facing).frame)
    }
    this.player.setDepth(this.player.y)

    // 出口检测
    const dExit = Math.hypot(this.player.x - (10 * TILE_SIZE + 16), this.player.y - (ROWS - 1) * TILE_SIZE)
    const near = dExit < 30
    if (near !== this.nearExit) {
      this.nearExit = near
      this.hud.prompt(near ? '按 E / 点击右侧按钮 离开房屋' : null)
    }
  }
}
