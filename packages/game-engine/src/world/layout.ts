import { TILE_SIZE, WORLD_COLS, WORLD_ROWS } from '../config'

/** 地块编码表。 */
export type TileCode =
  | '~' // 水（碰撞）
  | 'g' // 草地
  | 'G' // 深草地
  | 's' // 岸边
  | 'p' // 小路
  | 'f' // 广场砖
  | 'T' // 树（碰撞）
  | 'F' // 花丛（装饰）
  | 'n' // 栅栏（碰撞）
  | '.' // 种植地块（可交互）
  | 'H' // 房屋主体（碰撞）
  | 'D' // 房门（交互区，可通行）
  | '_' // 长椅（碰撞，未来可交互）

export type ActionKind = 'enter-house' | 'plot' | 'bench' | 'npc'

export interface Zone {
  id: string
  /** 格坐标 */
  col: number
  row: number
  /** 触发半径（像素） */
  radius: number
  prompt: string
  action: ActionKind
}

export const HOUSE = { col: 16, row: 4, w: 7, h: 5 } as const
export const HOUSE_DOOR = { col: 19, row: 8 } as const
export const GARDEN = { col: 26, row: 10, w: 10, h: 8 } as const
export const GARDEN_GATE = { col: 26, row: 14 } as const

const SOLID: ReadonlySet<TileCode> = new Set(['~', 'T', 'n', 'H', '_'])

export function isSolid(code: TileCode): boolean {
  return SOLID.has(code)
}

export interface WorldLayout {
  /** row-major 网格 [row][col] */
  grid: TileCode[][]
  zones: Zone[]
  /** 玩家出生点（像素） */
  spawn: { x: number; y: number }
  cols: number
  rows: number
}

function stampRect(grid: TileCode[][], col: number, row: number, w: number, h: number, code: TileCode): void {
  for (let r = row; r < row + h; r++) {
    for (let c = col; c < col + w; c++) {
      if (r >= 0 && r < grid.length && c >= 0 && c < grid[r].length) grid[r][c] = code
    }
  }
}

function stampPoint(grid: TileCode[][], col: number, row: number, code: TileCode): void {
  if (row >= 0 && row < grid.length && col >= 0 && col < grid[row].length) grid[row][col] = code
}

const TREES: ReadonlyArray<readonly [number, number]> = [
  [5, 4], [11, 4], [28, 4], [34, 6], [4, 10], [36, 10], [7, 16],
  [36, 15], [12, 24], [27, 24], [4, 21], [34, 20],
]
const FLOWERS: ReadonlyArray<readonly [number, number]> = [
  [4, 8], [12, 10], [24, 6], [29, 19], [36, 12], [8, 17], [13, 15], [33, 23], [22, 18], [6, 13],
]
const BENCHES: ReadonlyArray<readonly [number, number]> = [
  [16, 22], [23, 21],
]

/** 程序化构建世界网格：浮空小岛 + 住宅 + 花园 + 小路 + 种植区 + 广场。 */
export function buildWorldLayout(): WorldLayout {
  const grid: TileCode[][] = Array.from({ length: WORLD_ROWS }, () =>
    Array<TileCode>(WORLD_COLS).fill('g'),
  )

  // 水域环带（2 格宽）+ 岸边
  stampRect(grid, 0, 0, WORLD_COLS, 2, '~')
  stampRect(grid, 0, WORLD_ROWS - 2, WORLD_COLS, 2, '~')
  stampRect(grid, 0, 0, 2, WORLD_ROWS, '~')
  stampRect(grid, WORLD_COLS - 2, 0, 2, WORLD_ROWS, '~')
  stampRect(grid, 2, 2, WORLD_COLS - 4, 1, 's')
  stampRect(grid, 2, WORLD_ROWS - 3, WORLD_COLS - 4, 1, 's')
  stampRect(grid, 2, 3, 1, WORLD_ROWS - 6, 's')
  stampRect(grid, WORLD_COLS - 3, 3, 1, WORLD_ROWS - 6, 's')

  // 房屋主体（门保持可通行）
  stampRect(grid, HOUSE.col, HOUSE.row, HOUSE.w, HOUSE.h, 'H')
  stampPoint(grid, HOUSE_DOOR.col, HOUSE_DOOR.row, 'D')

  // 小路：房门 → 广场，支线 → 花园门
  stampRect(grid, 19, 9, 1, 11, 'p')
  stampRect(grid, 6, 20, 28, 1, 'p')
  stampRect(grid, 20, 14, 6, 1, 'p')

  // 花园：栅栏围合 + 门
  const g = GARDEN
  for (let c = g.col; c < g.col + g.w; c++) {
    stampPoint(grid, c, g.row, 'n')
    stampPoint(grid, c, g.row + g.h - 1, 'n')
  }
  for (let r = g.row; r < g.row + g.h; r++) {
    stampPoint(grid, g.col, r, 'n')
    stampPoint(grid, g.col + g.w - 1, r, 'n')
  }
  stampPoint(grid, GARDEN_GATE.col, GARDEN_GATE.row, 'p')
  // 种植区（4 列 × 3 行）
  for (let r = 12; r <= 14; r++) {
    for (let c = 28; c <= 31; c++) stampPoint(grid, c, r, '.')
  }

  // 广场
  stampRect(grid, 14, 21, 11, 4, 'f')

  for (const [c, r] of TREES) stampPoint(grid, c, r, 'T')
  for (const [c, r] of FLOWERS) stampPoint(grid, c, r, 'F')
  for (const [c, r] of BENCHES) stampPoint(grid, c, r, '_')

  const zones: Zone[] = [
    {
      id: 'house-door',
      col: HOUSE_DOOR.col,
      row: HOUSE_DOOR.row,
      radius: 26,
      prompt: '按 E / 点击右侧按钮 进入房屋',
      action: 'enter-house',
    },
    ...[12, 13, 14].flatMap((r) =>
      [28, 29, 30, 31].map((c) => ({
        id: `plot-${c}-${r}`,
        col: c,
        row: r,
        radius: 24,
        prompt: '按 E 种植（M4 开放）',
        action: 'plot' as const,
      })),
    ),
    ...BENCHES.map(([c, r], i) => ({
      id: `bench-${i}`,
      col: c,
      row: r,
      radius: 22,
      prompt: '按 E 休息（M4 开放）',
      action: 'bench' as const,
    })),
  ]

  return {
    grid,
    zones,
    spawn: { x: 19 * TILE_SIZE + TILE_SIZE / 2, y: 12 * TILE_SIZE },
    cols: WORLD_COLS,
    rows: WORLD_ROWS,
  }
}

/** 碰撞查询：像素坐标 → 是否实心。越界视为实心。 */
export function isSolidAt(layout: WorldLayout, pxX: number, pxY: number): boolean {
  const col = Math.floor(pxX / TILE_SIZE)
  const row = Math.floor(pxY / TILE_SIZE)
  if (row < 0 || row >= layout.rows || col < 0 || col >= layout.cols) return true
  return isSolid(layout.grid[row][col])
}
