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

export const BACKGROUND_PRESETS = {
  white: { label: 'White (default)', bg: '#ffffff', card: false },
  cream: { label: 'Warm cream', bg: '#faf6f0', card: true },
  sand: { label: 'Warm sand', bg: '#f3efe8', card: true },
  gray: { label: 'Soft gray', bg: '#f5f5f4', card: true },
} as const

export type BackgroundPresetKey = keyof typeof BACKGROUND_PRESETS
export const BACKGROUND_PRESET_KEYS = Object.keys(BACKGROUND_PRESETS) as BackgroundPresetKey[]

export const CONTENT_WIDTHS = {
  narrow: { label: 'Narrow (~720px)', px: 720 },
  medium: { label: 'Medium (default, ~960px)', px: 960 },
  wide: { label: 'Wide (~1140px)', px: 1140 },
} as const

export type ContentWidthKey = keyof typeof CONTENT_WIDTHS
export const CONTENT_WIDTH_KEYS = Object.keys(CONTENT_WIDTHS) as ContentWidthKey[]

export const TEXT_STYLES = {
  classic: { label: 'Classic (default)', color: '', emphasisUnderline: false },
  'navy-bold': { label: 'Navy Bold (editorial)', color: '#1e2a4a', emphasisUnderline: true },
} as const

export type TextStyleKey = keyof typeof TEXT_STYLES
export const TEXT_STYLE_KEYS = Object.keys(TEXT_STYLES) as TextStyleKey[]

export const HEADING_COLORS = {
  default: { label: 'Match body text (default)', color: '' },
  navy: { label: 'Navy', color: '#1e2a4a' },
  charcoal: { label: 'Charcoal', color: '#222222' },
  accent: { label: 'Accent purple', color: '#7852ee' },
} as const

export type HeadingColorKey = keyof typeof HEADING_COLORS
export const HEADING_COLOR_KEYS = Object.keys(HEADING_COLORS) as HeadingColorKey[]

export const HEADING_RULE_STYLES = {
  short: { label: 'Short line (default)', width: '48px' },
  full: { label: 'Full width line', width: '100%' },
  none: { label: 'No line', width: '0px' },
} as const

export type HeadingRuleStyleKey = keyof typeof HEADING_RULE_STYLES
export const HEADING_RULE_STYLE_KEYS = Object.keys(HEADING_RULE_STYLES) as HeadingRuleStyleKey[]

export const H2_RULE_COLORS = {
  green: { label: 'Green (default)', color: '#08b94e' },
  accent: { label: 'Accent purple', color: '#7852ee' },
  navy: { label: 'Navy', color: '#1e2a4a' },
  charcoal: { label: 'Charcoal', color: '#222222' },
} as const

export type H2RuleColorKey = keyof typeof H2_RULE_COLORS
export const H2_RULE_COLOR_KEYS = Object.keys(H2_RULE_COLORS) as H2RuleColorKey[]

export const LOGO_SIZES = {
  sm: { label: 'Small', px: 28 },
  md: { label: 'Medium (default)', px: 36 },
  lg: { label: 'Large', px: 48 },
  xl: { label: 'Extra large', px: 64 },
} as const

export type LogoSizeKey = keyof typeof LOGO_SIZES
export const LOGO_SIZE_KEYS = Object.keys(LOGO_SIZES) as LogoSizeKey[]
