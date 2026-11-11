/** 角色 Sprite 生成器：按配色参数程序化绘制 Q 版像素小人。
 *  画风依据 docs/art-reference/ART_STYLE.md：大瞳点睛、含蓄微笑、
 *  长发侧辫（女）/短碎发（男由配色与长度参数表达），32×32/帧。 */
import type Phaser from 'phaser'

import type { CharacterColors } from '../config'
import { DEFAULT_CHARACTER } from '../config'
import { PALETTE } from '../palettes'
import { box, px } from './pixel'

export const CHAR_TEXTURE = 'char'
export const CHAR_SIZE = 32
export type DirectionName = 'down' | 'up' | 'left' | 'right'
export const DIRECTIONS: readonly DirectionName[] = ['down', 'up', 'left', 'right']
export const WALK_FRAMES = 4

export interface CharacterSpec {
  colors: CharacterColors
  /** 长发（侧辫到腰）；false 为短发 */
  longHair: boolean
}

export const DEFAULT_SPEC: CharacterSpec = { colors: DEFAULT_CHARACTER, longHair: true }

export function resolveSpec(partial?: Partial<CharacterColors> & { longHair?: boolean }): CharacterSpec {
  return {
    colors: { ...DEFAULT_CHARACTER, ...partial },
    longHair: partial?.longHair ?? DEFAULT_SPEC.longHair,
  }
}

type Ctx = CanvasRenderingContext2D

function mirrored(ctx: Ctx, ox: number, oy: number, draw: () => void): void {
  ctx.save()
  ctx.translate(ox + CHAR_SIZE, oy)
  ctx.scale(-1, 1)
  draw()
  ctx.restore()
}

/** 正面帧 */
function drawDown(ctx: Ctx, ox: number, oy: number, f: number, spec: CharacterSpec): void {
  const c = spec.colors
  const legL = f === 1 ? 11 : f === 3 ? 13 : 12
  const legR = f === 1 ? 18 : f === 3 ? 16 : 17
  const armL = f === 1 ? 8 : 9
  const armR = f === 3 ? 22 : 21

  // 后发（长发垂到腰间）
  const hairLen = spec.longHair ? 15 : 8
  box(ctx, ox + 7, oy + 5, 3, hairLen, c.hairShade)
  box(ctx, ox + 22, oy + 5, 3, hairLen, c.hairShade)

  // 头（墨线勾边）
  box(ctx, ox + 8, oy + 4, 16, 13, PALETTE.ink)
  box(ctx, ox + 9, oy + 5, 14, 11, c.skin)

  // 发顶 + 刘海
  box(ctx, ox + 8, oy + 3, 16, 4, c.hair)
  box(ctx, ox + 9, oy + 6, 14, 1, c.hair)
  box(ctx, ox + 8, oy + 6, 2, 6, c.hair)
  box(ctx, ox + 22, oy + 6, 2, 6, c.hair)
  // 发辫缀饰（星点）
  if (spec.longHair) {
    px(ctx, ox + 8, oy + 14, PALETTE.wbrownLight)
    px(ctx, ox + 23, oy + 16, PALETTE.wbrownLight)
  }

  // 眼睛：大瞳 + 单点高光
  box(ctx, ox + 11, oy + 10, 3, 3, c.eyes)
  box(ctx, ox + 18, oy + 10, 3, 3, c.eyes)
  px(ctx, ox + 12, oy + 10, PALETTE.white)
  px(ctx, ox + 19, oy + 10, PALETTE.white)
  // 腮红 + 微笑
  px(ctx, ox + 10, oy + 12, PALETTE.pink)
  px(ctx, ox + 21, oy + 12, PALETTE.pink)
  px(ctx, ox + 15, oy + 13, PALETTE.pinkDark)
  px(ctx, ox + 16, oy + 13, PALETTE.pinkDark)

  // 身体：上衣 + 蓬裙（下摆深阶）
  box(ctx, ox + 10, oy + 15, 12, 6, PALETTE.ink)
  box(ctx, ox + 11, oy + 16, 10, 5, c.outfit)
  box(ctx, ox + 8, oy + 21, 16, 4, PALETTE.ink)
  box(ctx, ox + 9, oy + 21, 14, 3, c.outfit)
  box(ctx, ox + 9, oy + 24, 14, 1, c.outfitShade)
  px(ctx, ox + 15, oy + 17, c.outfitShade)

  // 手臂
  box(ctx, ox + armL, oy + 16, 2, 6, c.skin)
  box(ctx, ox + armR, oy + 16, 2, 6, c.skin)

  // 腿 + 鞋
  box(ctx, ox + legL, oy + 25, 3, 4, c.skin)
  box(ctx, ox + legR, oy + 25, 3, 4, c.skin)
  box(ctx, ox + legL - 1, oy + 29, 4, 2, PALETTE.wbrownDark)
  box(ctx, ox + legR - 1, oy + 29, 4, 2, PALETTE.wbrownDark)
}

/** 背面帧：头发全覆盖，无面部 */
function drawUp(ctx: Ctx, ox: number, oy: number, f: number, spec: CharacterSpec): void {
  const c = spec.colors
  const legL = f === 1 ? 11 : f === 3 ? 13 : 12
  const legR = f === 1 ? 18 : f === 3 ? 16 : 17
  const hairLen = spec.longHair ? 8 : 4

  box(ctx, ox + 8, oy + 4, 16, 13, PALETTE.ink)
  box(ctx, ox + 9, oy + 5, 14, 11, c.hair)
  box(ctx, ox + 9, oy + 13, 14, 2, c.hairShade)
  if (spec.longHair) {
    box(ctx, ox + 8, oy + 15, 16, hairLen, c.hairShade)
    box(ctx, ox + 10, oy + 15, 12, hairLen - 2, c.hair)
    px(ctx, ox + 12, oy + 20, c.hairShade)
    px(ctx, ox + 19, oy + 21, c.hairShade)
  }

  box(ctx, ox + 10, oy + 15, 12, 6, PALETTE.ink)
  box(ctx, ox + 11, oy + 16, 10, 5, c.outfit)
  box(ctx, ox + 8, oy + 21, 16, 4, PALETTE.ink)
  box(ctx, ox + 9, oy + 21, 14, 3, c.outfit)
  box(ctx, ox + 9, oy + 24, 14, 1, c.outfitShade)

  box(ctx, ox + legL, oy + 25, 3, 4, c.skin)
  box(ctx, ox + legR, oy + 25, 3, 4, c.skin)
  box(ctx, ox + legL - 1, oy + 29, 4, 2, PALETTE.wbrownDark)
  box(ctx, ox + legR - 1, oy + 29, 4, 2, PALETTE.wbrownDark)
}

/** 侧面帧（朝左）；朝右由镜像生成 */
function drawLeft(ctx: Ctx, ox: number, oy: number, f: number, spec: CharacterSpec): void {
  const c = spec.colors
  const frontLeg = f === 1 ? 10 : f === 3 ? 14 : 12
  const backLeg = f === 1 ? 18 : f === 3 ? 16 : 17
  const hairLen = spec.longHair ? 14 : 7

  // 后发（脑后，右侧）
  box(ctx, ox + 18, oy + 4, 5, hairLen + 2, c.hairShade)
  box(ctx, ox + 19, oy + 4, 4, hairLen, c.hair)

  box(ctx, ox + 9, oy + 4, 14, 13, PALETTE.ink)
  box(ctx, ox + 10, oy + 5, 12, 11, c.skin)
  // 发顶与刘海
  box(ctx, ox + 9, oy + 3, 14, 4, c.hair)
  box(ctx, ox + 10, oy + 6, 4, 3, c.hair)
  box(ctx, ox + 9, oy + 6, 2, 6, c.hair)
  if (spec.longHair) px(ctx, ox + 20, oy + 15, PALETTE.wbrownLight)

  // 单眼 + 高光
  box(ctx, ox + 11, oy + 10, 3, 3, c.eyes)
  px(ctx, ox + 12, oy + 10, PALETTE.white)
  px(ctx, ox + 10, oy + 12, PALETTE.pink)
  px(ctx, ox + 14, oy + 13, PALETTE.pinkDark)

  box(ctx, ox + 10, oy + 15, 12, 6, PALETTE.ink)
  box(ctx, ox + 11, oy + 16, 10, 5, c.outfit)
  box(ctx, ox + 8, oy + 21, 16, 4, PALETTE.ink)
  box(ctx, ox + 9, oy + 21, 14, 3, c.outfit)
  box(ctx, ox + 9, oy + 24, 14, 1, c.outfitShade)

  box(ctx, ox + 9, oy + 16, 2, 6, c.skin)
  box(ctx, ox + 21, oy + 16, 2, 6, c.skin)

  box(ctx, ox + frontLeg, oy + 25, 3, 4, c.skin)
  box(ctx, ox + backLeg, oy + 25, 3, 4, c.skin)
  box(ctx, ox + frontLeg - 1, oy + 29, 4, 2, PALETTE.wbrownDark)
  box(ctx, ox + backLeg - 1, oy + 29, 4, 2, PALETTE.wbrownDark)
}

/** 生成角色精灵表纹理（4 方向 × 4 帧，帧名 `${dir}-${i}`）。
 *  @param key 纹理键；居民 NPC 使用独立键 `char-npc-<id>`，玩家默认 `char`。 */
export function makeCharacter(scene: Phaser.Scene, spec: CharacterSpec, key: string = CHAR_TEXTURE): void {
  // 角色配色为会话级配置：纹理已存在则直接复用。
  // 切场景时移除重建会导致 Animation 帧引用失效（sourceSize null）。
  if (scene.textures.exists(key)) return
  const tex = scene.textures.createCanvas(key, CHAR_SIZE * WALK_FRAMES, CHAR_SIZE * DIRECTIONS.length)
  if (!tex) throw new Error('无法创建角色纹理')
  const ctx = tex.getContext()
  ctx.imageSmoothingEnabled = false

  DIRECTIONS.forEach((dir, row) => {
    for (let f = 0; f < WALK_FRAMES; f++) {
      const ox = f * CHAR_SIZE
      const oy = row * CHAR_SIZE
      if (dir === 'right') {
        mirrored(ctx, ox, oy, () => drawLeft(ctx, 0, 0, f, spec))
      } else if (dir === 'down') {
        drawDown(ctx, ox, oy, f, spec)
      } else if (dir === 'up') {
        drawUp(ctx, ox, oy, f, spec)
      } else {
        drawLeft(ctx, ox, oy, f, spec)
      }
      tex.add(`${dir}-${f}`, 0, ox, oy, CHAR_SIZE, CHAR_SIZE)
    }
  })
  tex.refresh()
}

/** 在独立画布上绘制角色正面帧，返回 dataURL（React 头像用）。 */
export function renderCharacterDataURL(
  partial?: Partial<CharacterColors> & { longHair?: boolean },
  scale = 3,
): string {
  const spec = resolveSpec(partial)
  const canvas = document.createElement('canvas')
  canvas.width = CHAR_SIZE * scale
  canvas.height = CHAR_SIZE * scale
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.scale(scale, scale)
  drawDown(ctx, 0, 0, 0, spec)
  return canvas.toDataURL('image/png')
}

export function walkAnimationFrames(dir: DirectionName): Array<{ key: string; frame: string }> {
  // 步态循环：迈步 → 并腿 → 反向迈步 → 并腿
  return [1, 0, 3, 2].map((i) => ({ key: CHAR_TEXTURE, frame: `${dir}-${i}` }))
}

export function idleFrame(dir: DirectionName): { key: string; frame: string } {
  return { key: CHAR_TEXTURE, frame: `${dir}-0` }
}
