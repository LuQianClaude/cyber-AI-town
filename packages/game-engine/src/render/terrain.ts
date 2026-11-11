/** 地形贴图：全部程序化生成，帧名注册到 'tiles' 纹理上。 */
import type Phaser from 'phaser'

import { TILE_SIZE } from '../config'
import { PALETTE } from '../palettes'
import { box, makeRng, px, speckle } from './pixel'

export const TILE_TEXTURE = 'tiles'
export const TILE_FRAMES = ['grass', 'grass2', 'shore', 'path', 'plaza', 'water', 'plot'] as const
export type TileFrame = (typeof TILE_FRAMES)[number]

export const TILE_FRAME_BY_CODE: Record<string, TileFrame> = {
  g: 'grass',
  G: 'grass2',
  s: 'shore',
  p: 'path',
  f: 'plaza',
  '~': 'water',
  '.': 'plot',
}

export function makeTerrainTextures(scene: Phaser.Scene): void {
  const size = TILE_SIZE
  if (scene.textures.exists(TILE_TEXTURE)) scene.textures.remove(TILE_TEXTURE)
  const tex = scene.textures.createCanvas(TILE_TEXTURE, size * TILE_FRAMES.length, size)
  if (!tex) return
  const ctx = tex.getContext()
  ctx.imageSmoothingEnabled = false

  TILE_FRAMES.forEach((name, i) => {
    const ox = i * size
    const rng = makeRng(0xc0ffee + i)
    switch (name) {
      case 'grass': {
        box(ctx, ox, 0, size, size, PALETTE.sage)
        speckle(ctx, rng, ox, 0, size, size, [PALETTE.sageDark, PALETTE.sageDark, PALETTE.sageLight], 9)
        break
      }
      case 'grass2': {
        box(ctx, ox, 0, size, size, PALETTE.sageDark)
        speckle(ctx, rng, ox, 0, size, size, [PALETTE.sage, PALETTE.sageLight], 14)
        break
      }
      case 'shore': {
        box(ctx, ox, 0, size, size, PALETTE.sage)
        speckle(ctx, rng, ox, 0, size, size - 6, [PALETTE.sage, PALETTE.sageLight], 14)
        box(ctx, ox, size - 5, size, 2, PALETTE.sageDark)
        box(ctx, ox, size - 3, size, 1, PALETTE.sky)
        box(ctx, ox, size - 2, size, 2, PALETTE.skyDark)
        break
      }
      case 'path': {
        box(ctx, ox, 0, size, size, '#D9C7A7')
        speckle(ctx, rng, ox, 0, size, size, ['#C7B08A', PALETTE.wbrownLight, '#E5D6B8'], 26)
        break
      }
      case 'plaza': {
        box(ctx, ox, 0, size, size, PALETTE.creamDeep)
        box(ctx, ox, 0, size, 1, '#DCCDB8')
        box(ctx, ox, 0, 1, size, '#DCCDB8')
        box(ctx, ox + 3, 3, size - 6, size - 6, PALETTE.cream)
        speckle(ctx, rng, ox + 3, 3, size - 6, size - 6, [PALETTE.creamDeep], 6)
        break
      }
      case 'water': {
        box(ctx, ox, 0, size, size, PALETTE.sky)
        for (let i = 0; i < 6; i++) {
          const wy = Math.floor(rng() * (size - 2))
          const wx = ox + Math.floor(rng() * (size - 6))
          box(ctx, wx, wy, 4, 1, PALETTE.skyLight)
        }
        speckle(ctx, rng, ox, 0, size, size, [PALETTE.skyDark], 6)
        break
      }
      case 'plot': {
        box(ctx, ox, 0, size, size, PALETTE.wbrownDark)
        for (let r = 3; r < size; r += 5) {
          box(ctx, ox + 2, r, size - 4, 2, PALETTE.wbrown)
        }
        speckle(ctx, rng, ox, 0, size, size, ['#6B4F38'], 10)
        break
      }
    }
    tex.add(name, 0, ox, 0, size, size)
  })
  tex.refresh()
}
