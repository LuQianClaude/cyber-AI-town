/** 结构体贴图：房屋外观/室内家具/树木/栅栏/长椅/花丛。程序化像素绘制。 */
import type Phaser from 'phaser'

import { TILE_SIZE } from '../config'
import { PALETTE } from '../palettes'
import { box, makeRng, px, speckle } from './pixel'

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number) {
  if (scene.textures.exists(key)) scene.textures.remove(key)
  const tex = scene.textures.createCanvas(key, w, h)
  if (!tex) throw new Error(`无法创建纹理: ${key}`)
  const ctx = tex.getContext()
  ctx.imageSmoothingEnabled = false
  return { tex, ctx }
}

/** 房屋外观：7×5 格。奶油墙 + 深胡桃木屋顶 + 雾墨蓝窗。 */
export function makeHouse(scene: Phaser.Scene): void {
  const w = TILE_SIZE * 7
  const h = TILE_SIZE * 5
  const { tex, ctx } = canvasTexture(scene, 'house', w, h)
  const rng = makeRng(0xbeef01)

  // 屋顶（阶梯坡面 + 瓦片纹理）
  for (let row = 0; row < 5; row++) {
    const inset = row * 12
    box(ctx, inset, row * 8, w - inset * 2, 8, PALETTE.ink)
    box(ctx, inset + 1, row * 8 + 1, w - inset * 2 - 2, 7, PALETTE.wbrownDark)
    for (let x = inset + 3; x < w - inset - 3; x += 6) {
      px(ctx, x, row * 8 + 3, PALETTE.wbrown)
      px(ctx, x + 2, row * 8 + 6, PALETTE.wbrown)
    }
  }
  // 烟囱
  box(ctx, w - 52, 6, 16, 30, PALETTE.ink)
  box(ctx, w - 51, 7, 14, 29, PALETTE.wbrownDark)
  box(ctx, w - 54, 4, 20, 4, PALETTE.wbrown)

  // 墙体
  box(ctx, 4, 40, w - 8, h - 40, PALETTE.ink)
  box(ctx, 5, 41, w - 10, h - 42, PALETTE.cream)
  // 木骨架
  box(ctx, 5, 41, w - 10, 3, PALETTE.wbrown)
  box(ctx, 5, h - 24, w - 10, 3, PALETTE.wbrown)
  box(ctx, 5, 41, 3, h - 42, PALETTE.wbrown)
  box(ctx, w - 8, 41, 3, h - 42, PALETTE.wbrown)
  speckle(ctx, rng, 8, 46, w - 16, h - 76, [PALETTE.creamDeep], 24)

  // 窗 ×2（雾墨蓝玻璃 + 十字框）
  for (const wx of [40, w - 72]) {
    box(ctx, wx, 76, 32, 32, PALETTE.ink)
    box(ctx, wx + 2, 78, 28, 28, PALETTE.sky)
    box(ctx, wx + 14, 78, 2, 28, PALETTE.cream)
    box(ctx, wx + 2, 90, 28, 2, PALETTE.cream)
    px(ctx, wx + 5, 81, PALETTE.skyLight)
    px(ctx, wx + 8, 84, PALETTE.skyLight)
  }

  // 门（2 格宽，位于中央偏下）
  const doorX = 96
  box(ctx, doorX - 2, 96, 36, h - 96, PALETTE.ink)
  box(ctx, doorX, 98, 32, h - 98, PALETTE.wbrown)
  box(ctx, doorX + 4, 102, 24, h - 108, PALETTE.wbrownDark)
  px(ctx, doorX + 26, 126, PALETTE.wbrownLight)
  // 门槛石
  box(ctx, doorX - 6, h - 4, 44, 4, '#B8B2A6')
  tex.refresh()
}

export function makeTree(scene: Phaser.Scene): void {
  const { tex, ctx } = canvasTexture(scene, 'tree', 64, 80)
  // 树干
  box(ctx, 28, 52, 8, 28, PALETTE.ink)
  box(ctx, 29, 52, 6, 28, PALETTE.wbrownDark)
  px(ctx, 30, 58, PALETTE.wbrown)
  px(ctx, 33, 66, PALETTE.wbrown)
  // 树冠（三层明度）
  const blob = (x: number, y: number, w: number, h: number, c: string) => {
    box(ctx, x + 2, y, w - 4, h, c)
    box(ctx, x, y + 2, w, h - 4, c)
  }
  blob(6, 22, 52, 40, PALETTE.ink)
  blob(7, 23, 50, 38, PALETTE.sageDark)
  blob(10, 20, 44, 34, PALETTE.sage)
  blob(16, 16, 32, 24, PALETTE.sageLight)
  px(ctx, 20, 22, PALETTE.sage)
  px(ctx, 36, 20, PALETTE.sage)
  px(ctx, 24, 40, PALETTE.pink)
  px(ctx, 42, 34, PALETTE.pink)
  px(ctx, 30, 30, PALETTE.white)
  tex.refresh()
}

export function makeFence(scene: Phaser.Scene): void {
  const { tex, ctx } = canvasTexture(scene, 'fence', TILE_SIZE, TILE_SIZE)
  for (const x of [4, 22]) {
    box(ctx, x, 6, 6, 26, PALETTE.ink)
    box(ctx, x + 1, 7, 4, 25, PALETTE.wbrown)
    box(ctx, x + 1, 7, 4, 2, PALETTE.wbrownLight)
  }
  box(ctx, 0, 10, TILE_SIZE, 4, PALETTE.ink)
  box(ctx, 0, 11, TILE_SIZE, 2, PALETTE.wbrownDark)
  box(ctx, 0, 22, TILE_SIZE, 4, PALETTE.ink)
  box(ctx, 0, 23, TILE_SIZE, 2, PALETTE.wbrownDark)
  tex.refresh()
}

export function makeBench(scene: Phaser.Scene): void {
  const { tex, ctx } = canvasTexture(scene, 'bench', TILE_SIZE, TILE_SIZE)
  box(ctx, 4, 12, 24, 6, PALETTE.ink)
  box(ctx, 5, 13, 22, 4, PALETTE.wbrown)
  box(ctx, 6, 6, 20, 4, PALETTE.ink)
  box(ctx, 7, 7, 18, 2, PALETTE.wbrownDark)
  box(ctx, 6, 18, 4, 8, PALETTE.ink)
  box(ctx, 22, 18, 4, 8, PALETTE.ink)
  box(ctx, 7, 18, 2, 8, PALETTE.wbrownDark)
  box(ctx, 23, 18, 2, 8, PALETTE.wbrownDark)
  tex.refresh()
}

export function makeFlowers(scene: Phaser.Scene): void {
  const { tex, ctx } = canvasTexture(scene, 'flowers', TILE_SIZE, TILE_SIZE)
  const rng = makeRng(0xf10a)
  for (let i = 0; i < 3; i++) {
    const bx = 6 + Math.floor(rng() * 20)
    const by = 10 + Math.floor(rng() * 16)
    box(ctx, bx, by + 3, 1, 6, PALETTE.sageDark)
    px(ctx, bx - 1, by + 5, PALETTE.sage)
    px(ctx, bx + 1, by + 6, PALETTE.sage)
    px(ctx, bx, by, PALETTE.pinkDark)
    px(ctx, bx - 1, by + 1, PALETTE.pink)
    px(ctx, bx + 1, by + 1, PALETTE.pink)
    px(ctx, bx, by + 2, PALETTE.pink)
    px(ctx, bx, by + 1, PALETTE.white)
  }
  speckle(ctx, rng, 2, 24, 28, 6, [PALETTE.sage, PALETTE.sageDark], 10)
  tex.refresh()
}

/** 室内资产 */
export function makeInterior(scene: Phaser.Scene): void {
  // 木地板
  {
    const { tex, ctx } = canvasTexture(scene, 'floor', TILE_SIZE, TILE_SIZE)
    box(ctx, 0, 0, TILE_SIZE, TILE_SIZE, PALETTE.wbrown)
    box(ctx, 0, 0, TILE_SIZE, 1, PALETTE.wbrownDark)
    box(ctx, 0, 15, TILE_SIZE, 2, PALETTE.wbrownDark)
    box(ctx, 0, 16, TILE_SIZE, 1, PALETTE.wbrownLight)
    px(ctx, 8, 6, PALETTE.wbrownLight)
    px(ctx, 22, 24, PALETTE.wbrownLight)
    tex.refresh()
  }
  // 墙（奶油 + 胡桃木护墙板）
  {
    const { tex, ctx } = canvasTexture(scene, 'wall', TILE_SIZE, TILE_SIZE)
    box(ctx, 0, 0, TILE_SIZE, TILE_SIZE, PALETTE.cream)
    box(ctx, 0, 22, TILE_SIZE, 10, PALETTE.wbrown)
    box(ctx, 0, 22, TILE_SIZE, 1, PALETTE.wbrownDark)
    box(ctx, 0, 31, TILE_SIZE, 1, PALETTE.wbrownDark)
    px(ctx, 6, 8, PALETTE.creamDeep)
    px(ctx, 20, 12, PALETTE.creamDeep)
    tex.refresh()
  }
  // 地毯
  {
    const { tex, ctx } = canvasTexture(scene, 'rug', 96, 64)
    box(ctx, 0, 0, 96, 64, PALETTE.pinkDark)
    box(ctx, 4, 4, 88, 56, PALETTE.pink)
    box(ctx, 10, 10, 76, 44, PALETTE.pinkDark)
    box(ctx, 14, 14, 68, 36, PALETTE.pink)
    tex.refresh()
  }
  // 床
  {
    const { tex, ctx } = canvasTexture(scene, 'bed', 96, 64)
    box(ctx, 0, 0, 96, 64, PALETTE.ink)
    box(ctx, 2, 2, 92, 60, PALETTE.wbrown)
    box(ctx, 4, 4, 88, 56, PALETTE.cream)
    box(ctx, 4, 4, 88, 22, PALETTE.skyLight)
    box(ctx, 4, 24, 88, 2, PALETTE.sky)
    box(ctx, 10, 8, 24, 14, PALETTE.white)
    box(ctx, 62, 8, 24, 14, PALETTE.white)
    box(ctx, 10, 11, 24, 1, PALETTE.pink)
    box(ctx, 62, 11, 24, 1, PALETTE.pink)
    tex.refresh()
  }
  // 书架
  {
    const { tex, ctx } = canvasTexture(scene, 'shelf', 64, 80)
    box(ctx, 0, 0, 64, 80, PALETTE.ink)
    box(ctx, 2, 2, 60, 76, PALETTE.wbrown)
    const bookColors = [PALETTE.pinkDark, PALETTE.sky, PALETTE.sage, PALETTE.creamDeep, PALETTE.wbrownDark]
    for (let row = 0; row < 3; row++) {
      const y = 8 + row * 24
      box(ctx, 6, y + 14, 52, 3, PALETTE.wbrownDark)
      let x = 8
      let i = row * 2
      while (x < 54) {
        const bw = 5 + ((i * 7) % 5)
        box(ctx, x, y + 2, bw, 12, bookColors[i % bookColors.length])
        px(ctx, x + 1, y + 4, PALETTE.ink)
        x += bw + 2
        i++
      }
    }
    tex.refresh()
  }
  // 餐桌
  {
    const { tex, ctx } = canvasTexture(scene, 'table', 64, 48)
    box(ctx, 0, 0, 64, 48, PALETTE.ink)
    box(ctx, 2, 2, 60, 44, PALETTE.wbrown)
    box(ctx, 4, 4, 56, 40, PALETTE.creamDeep)
    box(ctx, 28, 14, 8, 8, PALETTE.pink)
    px(ctx, 31, 16, PALETTE.white)
    box(ctx, 6, 42, 6, 6, PALETTE.wbrownDark)
    box(ctx, 52, 42, 6, 6, PALETTE.wbrownDark)
    tex.refresh()
  }
  // 绿植盆栽
  {
    const { tex, ctx } = canvasTexture(scene, 'plant', 32, 48)
    box(ctx, 8, 32, 16, 14, PALETTE.ink)
    box(ctx, 9, 33, 14, 12, PALETTE.pinkDark)
    box(ctx, 14, 8, 3, 24, PALETTE.sageDark)
    px(ctx, 10, 12, PALETTE.sage)
    px(ctx, 20, 10, PALETTE.sage)
    px(ctx, 12, 6, PALETTE.sageLight)
    px(ctx, 18, 16, PALETTE.sage)
    tex.refresh()
  }
}
