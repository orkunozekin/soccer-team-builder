import { describe, expect, it } from 'vitest'
import { getInitials } from './initials-avatar'

describe('getInitials', () => {
  it('uses the first and last words', () => {
    expect(getInitials('Alex Morgan')).toBe('AM')
    expect(getInitials('  Grace  ')).toBe('Gr')
    expect(getInitials('')).toBe('?')
  })

  it('keeps supplementary-plane characters whole', () => {
    const first = '\u{1D400}'
    const last = '\u{1D401}'
    expect(getInitials(`${first}lice ${last}erg`)).toBe(`${first}${last}`)
    expect(getInitials(`${first}${last}`)).toBe(`${first}${last}`)
  })
})
