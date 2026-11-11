/** 全局色板：与 apps/web Tailwind 主题同源，像素资产全部从此取色。 */
export const PALETTE = {
  cream: '#FAF6EF',
  creamDeep: '#F1EAE0',
  sage: '#9CAF88',
  sageLight: '#C8D6BC',
  sageDark: '#6F8560',
  sky: '#A8C5DA',
  skyLight: '#D6E6F2',
  skyDark: '#6E97B8',
  wbrown: '#7A5C45',
  wbrownDark: '#54402F',
  wbrownLight: '#A98F78',
  pink: '#F2C4CE',
  pinkDark: '#D89AA8',
  ink: '#2E2A26',
  white: '#FFFFFF',
} as const

export type PaletteKey = keyof typeof PALETTE
