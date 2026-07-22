export const FONT_PRESETS = {
  'fraunces-manrope': { label: 'Fraunces + Manrope (editorial)', heading: 'Fraunces', body: 'Manrope' },
  'geist': { label: 'Geist (modern, single family)', heading: 'Geist', body: 'Geist' },
  'manrope': { label: 'Manrope (modern, single family)', heading: 'Manrope', body: 'Manrope' },
  'inter': { label: 'Inter (original default)', heading: 'Inter', body: 'Inter' },
} as const

export type FontPresetKey = keyof typeof FONT_PRESETS
export const FONT_PRESET_KEYS = Object.keys(FONT_PRESETS) as FontPresetKey[]

export const FONT_SIZES = {
  xs: { label: 'Extra small', base: 13 },
  sm: { label: 'Small', base: 15 },
  md: { label: 'Medium (default)', base: 16 },
  lg: { label: 'Large', base: 18 },
} as const

export type FontSizeKey = keyof typeof FONT_SIZES
export const FONT_SIZE_KEYS = Object.keys(FONT_SIZES) as FontSizeKey[]
