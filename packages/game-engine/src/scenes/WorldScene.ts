/** 世界场景：浮空小岛外部。移动 / 碰撞 / 摄像机跟随 / 交互区。 */
import Phaser from 'phaser'

import { CAMERA_ZOOM, PLAYER_SPEED, TILE_SIZE, type NpcConfig } from '../config'
import { PALETTE } from '../palettes'
import { makeCharacter, CHAR_TEXTURE, walkAnimationFrames, idleFrame, type DirectionName, resolveSpec } from '../render/character'
import { makeHouse, makeTree, makeFence, makeBench, makeFlowers } from '../render/structures'
import { makeTerrainTextures, TILE_TEXTURE, TILE_FRAME_BY_CODE } from '../render/terrain'
import { buildWorldLayout, isSolidAt, HOUSE, type Zone, type WorldLayout } from '../world/layout'
import { facingFromVector, keyboardVector, type InputVector } from '../systems/input'
import { createPatrolState, stepPatrol, type PatrolState } from '../systems/patrol'
import { makeJoystick, makeInteractButton } from '../systems/joystick'
import { makeHud, type Hud } from '../ui/hud'
import { emitStatus } from './events'

const OBJECT_TEXTURE_BY_CODE: Record<string, string> = {
  T: 'tree',
  n: 'fence',
  _: 'bench',
  F: 'flowers',
}

const PLAYER_BODY = { hw: 6, top: 2, bottom: 15 } as const

/** NPC 交互区：在布局 Zone 基础上挂居民 id。 */
interface NpcZone extends Zone {
  action: 'npc'
  npcId: string
}

interface NpcEntry {
  id: string
  sprite: Phaser.GameObjects.Sprite
  label: Phaser.GameObjects.Text
  home: { x: number; y: number }
  patrol: PatrolState
  zone: NpcZone
}

export class WorldScene extends Phaser.Scene {
  private layout: WorldLayout = buildWorldLayout()
  player!: Phaser.GameObjects.Sprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private pressed = new Set<string>()
  facing: DirectionName = 'down'
  private joystick!: ReturnType<typeof makeJoystick>
  private hud!: Hud
  private zones: Zone[] = []
  private npcs: NpcEntry[] = []
  private nearZone: (Zone | NpcZone) | null = null
  private moveFlags = { vx: 0, vy: 0 }

  constructor() {
    super('World')
  }

  create(): void {
    this.layout = buildWorldLayout()
    this.zones = this.layout.zones

    this.makeTextures()
    this.drawGround()
    this.drawObjects()
    this.createPlayer()
    this.spawnNpcs()
    this.setupCamera()
    this.setupInput()
    this.hud = makeHud(this)
    this.scale.on('resize', this.hud.reposition)

    emitStatus(this, '世界已就绪')
    this.registry.get('onReady')?.()
  }

  // ---------- 资产与绘制 ----------

  private makeTextures(): void {
    makeTerrainTextures(this)
    makeHouse(this)
    makeTree(this)
    makeFence(this)
    makeBench(this)
    makeFlowers(this)
    const spec = resolveSpec(this.registry.get('playerConfig'))
    makeCharacter(this, spec)

    for (const dir of ['down', 'up', 'left', 'right'] as DirectionName[]) {
      this.anims.create({ key: `walk-${dir}`, frames: walkAnimationFrames(dir), frameRate: 8, repeat: -1 })
    }
  }

  private drawGround(): void {
    const { grid, cols, rows } = this.layout
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const code = grid[row][col]
        const frame = TILE_FRAME_BY_CODE[code]
        const x = col * TILE_SIZE + TILE_SIZE / 2
        const y = row * TILE_SIZE + TILE_SIZE / 2
        if (frame) {
          this.add.image(x, y, TILE_TEXTURE, frame).setDepth(0)
        } else {
          this.add.image(x, y, TILE_TEXTURE, 'grass').setDepth(0)
        }
        if (code === 'D') {
          // 门口踏板
          this.add.image(x, y, TILE_TEXTURE, 'path').setDepth(0)
        }
      }
    }
  }

  private drawObjects(): void {
    const { grid, cols, rows } = this.layout
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const code = grid[row][col]
        const x = col * TILE_SIZE + TILE_SIZE / 2
        const y = row * TILE_SIZE + TILE_SIZE / 2
        if (code === 'H' && col === HOUSE.col && row === HOUSE.row) {
          // 房屋整体贴图，锚点取左上
          this.add
            .image(HOUSE.col * TILE_SIZE, HOUSE.row * TILE_SIZE, 'house')
            .setOrigin(0, 0)
            .setDepth(2000)
          continue
        }
        if (code === 'H' || code === 'D') continue
        const texKey = OBJECT_TEXTURE_BY_CODE[code]
        if (texKey) {
          const depth = y + (texKey === 'tree' ? 30 : 10)
          this.add.image(x, y, texKey).setDepth(depth)
        }
      }
    }
  }

  private createPlayer(): void {
    const spawn = this.layout.spawn
    this.player = this.add.sprite(spawn.x, spawn.y, CHAR_TEXTURE, 'down-0').setDepth(spawn.y)
    this.facing = 'down'
    this.player.setFrame('down-0')
  }

  // ---------- AI 居民 NPC（M2） ----------

  /** 广场可站位：扫描广场区非碰撞格，均匀取点。 */
  private npcSlots(count: number): Array<{ col: number; row: number }> {
    const free: Array<{ col: number; row: number }> = []
    for (let row = 20; row <= 25; row++) {
      for (let col = 13; col <= 25; col++) {
        const x = col * TILE_SIZE + TILE_SIZE / 2
        const y = row * TILE_SIZE + TILE_SIZE / 2
        if (!this.bodySolidAt(x, y)) free.push({ col, row })
      }
    }
    const slots: Array<{ col: number; row: number }> = []
    for (let i = 0; i < count && free.length > 0; i++) {
      slots.push(free[Math.floor((i * free.length) / count)])
    }
    return slots
  }

  private spawnNpcs(): void {
    const configs = (this.registry.get('npcs') ?? []) as NpcConfig[]
    if (!configs.length) return
    const slots = this.npcSlots(configs.length)
    configs.forEach((npc, i) => {
      const slot = slots[i] ?? { col: 18, row: 22 }
      const x = slot.col * TILE_SIZE + TILE_SIZE / 2
      const y = slot.row * TILE_SIZE + TILE_SIZE / 2
      const key = `char-npc-${npc.id}`
      makeCharacter(this, resolveSpec({ ...npc.colors, longHair: npc.longHair }), key)

      const sprite = this.add.sprite(x, y, key, 'down-0').setDepth(y).setInteractive({ useHandCursor: true })
      const label = this.add
        .text(x, y - 26, npc.nickname, {
          fontFamily: '"Courier New", monospace',
          fontSize: '10px',
          color: PALETTE.ink,
          backgroundColor: '#FAF6EFD9',
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5, 1)
        .setDepth(y + 1)

      const zone: NpcZone = {
        id: `npc:${npc.id}`,
        col: slot.col,
        row: slot.row,
        radius: 46,
        prompt: `和 ${npc.nickname} 聊聊`,
        action: 'npc',
        npcId: npc.id,
      }
      sprite.on('pointerdown', () => {
        if (Math.hypot(this.player.x - sprite.x, this.player.y - sprite.y) <= 72) this.interactNpc(npc.id)
        else emitStatus(this, '再走近一点')
      })
      this.npcs.push({ id: npc.id, sprite, label, home: { x, y }, patrol: createPatrolState(), zone })
    })
  }

  private interactNpc(npcId: string): void {
    ;(this.registry.get('onNpcInteract') as ((id: string) => void) | null)?.(npcId)
    emitStatus(this, `npc:${npcId}`)
  }

  private setupCamera(): void {
    const cam = this.cameras.main
    cam.setBounds(0, 0, this.layout.cols * TILE_SIZE, this.layout.rows * TILE_SIZE)
    cam.setBackgroundColor(PALETTE.cream)
    cam.setZoom(CAMERA_ZOOM)
    cam.startFollow(this.player, true, 0.12, 0.12)
  }

  // ---------- 输入 ----------

  private setupInput(): void {
    const keyboard = this.input.keyboard!
    this.cursors = keyboard.createCursorKeys()
    this.keys = keyboard.addKeys('W,A,S,D,E') as Record<string, Phaser.Input.Keyboard.Key>

    keyboard.on('keydown', (e: KeyboardEvent) => {
      this.pressed.add(e.code)
      if (e.code === 'KeyE') this.tryInteract()
    })
    keyboard.on('keyup', (e: KeyboardEvent) => this.pressed.delete(e.code))

    this.joystick = makeJoystick(this)
    makeInteractButton(this, () => this.tryInteract())
  }

  // ---------- 交互 ----------

  private updateNearZone(): void {
    let best: (Zone | NpcZone) | null = null
    let bestDist = Infinity
    for (const zone of [...this.zones, ...this.npcs.map((n) => n.zone)]) {
      const zx = zone.col * TILE_SIZE + TILE_SIZE / 2
      const zy = zone.row * TILE_SIZE + TILE_SIZE / 2
      const d = Math.hypot(this.player.x - zx, this.player.y - zy)
      if (d < zone.radius && d < bestDist) {
        best = zone
        bestDist = d
      }
    }
    if (best?.id !== this.nearZone?.id) {
      this.nearZone = best
      this.hud.prompt(best ? best.prompt : null)
    }
  }

  private tryInteract(): void {
    const zone = this.nearZone
    if (!zone) return
    switch (zone.action) {
      case 'enter-house':
        this.cameras.main.fadeOut(220, 46, 42, 38)
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.start('House', {
            returnX: this.player.x,
            returnY: this.player.y,
          })
        })
        break
      case 'plot':
        this.hud.toast('翻好了土，等待 M4 播种')
        emitStatus(this, 'plot')
        break
      case 'bench':
        this.hud.toast('长椅很干净，M4 可以坐下休息')
        emitStatus(this, 'bench')
        break
      case 'npc':
        this.interactNpc((zone as NpcZone).npcId)
        break
    }
  }

  // ---------- 移动与碰撞 ----------

  private inputVector(): InputVector {
    const kb = keyboardVector(this.pressed)
    if (kb.x !== 0 || kb.y !== 0) return kb
    return this.joystick.vector()
  }

  private bodySolidAt(x: number, y: number): boolean {
    const { hw, top, bottom } = PLAYER_BODY
    // 四角采样
    return (
      isSolidAt(this.layout, x - hw, y + top) ||
      isSolidAt(this.layout, x + hw, y + top) ||
      isSolidAt(this.layout, x - hw, y + bottom) ||
      isSolidAt(this.layout, x + hw, y + bottom)
    )
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05)
    const v = this.inputVector()
    this.moveFlags.vx = v.x
    this.moveFlags.vy = v.y

    const dx = v.x * PLAYER_SPEED * dt
    const dy = v.y * PLAYER_SPEED * dt
    if (dx !== 0 || dy !== 0) {
      if (!this.bodySolidAt(this.player.x + dx, this.player.y)) this.player.x += dx
      if (!this.bodySolidAt(this.player.x, this.player.y + dy)) this.player.y += dy

      const dir = facingFromVector(v)
      if (dir !== this.facing) {
        this.facing = dir
      }
      this.player.play(`walk-${this.facing}`, true)
    } else {
      this.player.stop()
      this.player.setFrame(idleFrame(this.facing).frame)
    }
    this.player.setDepth(this.player.y)
    // NPC 自主巡逻（M3 行为引擎）：围绕出生点游走，交互区跟随
    for (const npc of this.npcs) {
      const pos = stepPatrol(npc.patrol, dt, { x: npc.sprite.x, y: npc.sprite.y }, npc.home, Math.random, (x, y) =>
        this.bodySolidAt(x, y),
      )
      npc.sprite.setPosition(pos.x, pos.y)
      npc.sprite.setDepth(pos.y)
      npc.label.setPosition(pos.x, pos.y - 26)
      npc.label.setDepth(pos.y + 1)
      npc.zone.col = Math.floor(pos.x / TILE_SIZE)
      npc.zone.row = Math.floor(pos.y / TILE_SIZE)
    }
    this.updateNearZone()
  }

  shutdown(): void {
    this.npcs = []
    this.nearZone = null
    this.hud?.destroy()
    this.scale.off('resize', this.hud?.reposition)
  }
}
