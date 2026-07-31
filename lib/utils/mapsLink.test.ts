import { describe, expect, it } from 'vitest'
import { getMapsUrl } from './mapsLink'

describe('getMapsUrl', () => {
  it('prefers coordinates over address when both exist', () => {
    const url = getMapsUrl({
      name: 'Rec Field 4',
      address: 'Some campus road that geocodes wrong',
      lat: 30.2849,
      lng: -97.7341,
    })
    expect(url).toContain('30.2849')
    expect(url).toContain('-97.7341')
    expect(url).not.toContain('campus')
  })

  it('falls back to address when coords are missing', () => {
    const url = getMapsUrl({
      name: 'Rec Field 4',
      address: '2100 Barton Springs Rd, Austin, TX',
      lat: null,
      lng: null,
    })
    expect(url).toContain(encodeURIComponent('2100 Barton Springs Rd, Austin, TX'))
  })
})
