/**
 * Team pinny palette, in team-number order (team 1 = Orange). New team docs
 * store these colours; older docs may still hold the previous saturated hexes.
 */
export const TEAM_PALETTE = [
  { name: 'Orange', color: '#FF8641' },
  { name: 'Blue', color: '#8BC3DC' },
  { name: 'Yellow', color: '#F2D45C' },
  { name: 'Lime', color: '#BAE87B' },
  { name: 'Red', color: '#FF7A7B' },
  { name: 'Purple', color: '#B9A3F0' },
] as const

export type TeamPaletteEntry = (typeof TEAM_PALETTE)[number]

/** Fallback when a team doc has no colour. */
export const DEFAULT_TEAM_COLOR: string = TEAM_PALETTE[1].color

const DARK_TEXT = '#0B0F0D'
const LIGHT_TEXT = '#FFFFFF'

/** Palette entry for a 1-based team number; wraps past the palette length. */
export function teamPaletteEntry(teamNumber: number): TeamPaletteEntry {
  const n = TEAM_PALETTE.length
  const index = (((Math.trunc(teamNumber) - 1) % n) + n) % n
  return TEAM_PALETTE[index]
}

export function resolveTeamColor(color: string | null | undefined): string {
  return color || DEFAULT_TEAM_COLOR
}

function relativeLuminance(hex: string): number | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const value = parseInt(match[1], 16)
  const channels = [value >> 16, (value >> 8) & 0xff, value & 0xff].map(c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

/**
 * Jersey-number text colour for a team-coloured disc or badge: whichever of
 * ink or white has the higher WCAG contrast (works for legacy hexes too).
 */
export function teamTextColor(background: string | null | undefined): string {
  const lum = relativeLuminance(resolveTeamColor(background))
  if (lum === null) return LIGHT_TEXT
  const darkLum = relativeLuminance(DARK_TEXT) ?? 0
  const contrastWithDark = (lum + 0.05) / (darkLum + 0.05)
  const contrastWithLight = 1.05 / (lum + 0.05)
  return contrastWithDark >= contrastWithLight ? DARK_TEXT : LIGHT_TEXT
}
