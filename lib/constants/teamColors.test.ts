import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TEAM_COLOR,
  TEAM_PALETTE,
  resolveTeamColor,
  teamPaletteEntry,
  teamTextColor,
} from './teamColors'

describe('teamPaletteEntry', () => {
  it('maps team numbers to the pinny palette', () => {
    expect(teamPaletteEntry(1)).toEqual({ name: 'Orange', color: '#FF8641' })
    expect(teamPaletteEntry(2)).toEqual({ name: 'Blue', color: '#8BC3DC' })
  })

  it('wraps past the palette and tolerates out-of-range numbers', () => {
    expect(teamPaletteEntry(TEAM_PALETTE.length + 1)).toBe(TEAM_PALETTE[0])
    expect(teamPaletteEntry(0)).toBe(TEAM_PALETTE[TEAM_PALETTE.length - 1])
  })
})

describe('resolveTeamColor', () => {
  it('falls back to the default colour', () => {
    expect(resolveTeamColor(null)).toBe(DEFAULT_TEAM_COLOR)
    expect(resolveTeamColor('')).toBe(DEFAULT_TEAM_COLOR)
    expect(resolveTeamColor('#123456')).toBe('#123456')
  })
})

describe('teamTextColor', () => {
  it('uses dark text on every pinny colour', () => {
    for (const { color } of TEAM_PALETTE) {
      expect(teamTextColor(color)).toBe('#0B0F0D')
    }
  })

  it('uses white text on dark legacy colours', () => {
    expect(teamTextColor('#1e40af')).toBe('#FFFFFF')
  })

  it('falls back to white for unparseable colours', () => {
    expect(teamTextColor('rebeccapurple')).toBe('#FFFFFF')
  })
})
