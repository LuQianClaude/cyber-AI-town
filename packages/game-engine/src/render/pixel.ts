/** 像素绘制原语。所有资产生成只允许使用这里的原语，保证风格统一。 */

export function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

export function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color
  ctx.fillRect(x, y, 1, 1)
}

/** 确定性伪随机（LCG），避免资产生成引入不可复现的随机性。 */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

export function speckle(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  x: number,
  y: number,
  w: number,
  h: number,
  colors: string[],
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    px(ctx, x + Math.floor(rng() * w), y + Math.floor(rng() * h), colors[Math.floor(rng() * colors.length)])
  }
}
