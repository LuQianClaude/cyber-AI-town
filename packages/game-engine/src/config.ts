/** 世界常量。修改此处即可全局调整尺度。 */
export const TILE_SIZE = 32
export const WORLD_COLS = 40
export const WORLD_ROWS = 28
export const CAMERA_ZOOM = 2
export const PLAYER_SPEED = 96 // px/s，3 格/秒

/** 世界中的 AI 居民 NPC（M2）。位置缺省时由引擎在广场自动排位。 */
export interface NpcConfig {
  id: string
  nickname: string
  colors: Partial<CharacterColors>
  longHair?: boolean
  /** 格坐标；缺省自动排位 */
  col?: number
  row?: number
}

export interface EngineConfig {
  parent: HTMLElement | string
  player?: Partial<CharacterColors> & { longHair?: boolean }
  /** 世界中的 AI 居民（可选，登录后传入） */
  npcs?: NpcConfig[]
  /** 靠近居民按互动 / 点击居民时回调（M2：跳转到聊天） */
  onNpcInteract?: (npcId: string) => void
  debug?: boolean
  onStatus?: (message: string) => void
  onReady?: () => void
}

export interface CharacterColors {
  hair: string
  hairShade: string
  eyes: string
  outfit: string
  outfitShade: string
  skin: string
  skinShade: string
}

/** 默认皮肤：取自 docs/art-reference 女款参考图（黑发黑瞳米白裙）。 */
export const DEFAULT_CHARACTER: CharacterColors = {
  hair: '#26262C',
  hairShade: '#17171B',
  eyes: '#4A3B2F',
  outfit: '#F3E9DC',
  outfitShade: '#DCCDB8',
  skin: '#F8E7D8',
  skinShade: '#EAC9AF',
}
