import { afterEach, describe, expect, it, vi } from 'vitest'
import { getMapsUrl } from './mapsLink'

describe('getMapsUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

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
    expect(url.startsWith('https://www.google.com/maps/')).toBe(true)
  })

  it('falls back to address when coords are missing', () => {
    const url = getMapsUrl({
      name: 'Rec Field 4',
      address: '2100 Barton Springs Rd, Austin, TX',
      lat: null,
      lng: null,
    })
    expect(url).toContain(
      encodeURIComponent('2100 Barton Springs Rd, Austin, TX')
    )
  })

  it('uses Google Maps HTTPS on Android instead of geo: URIs', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
      platform: 'Linux armv8l',
      maxTouchPoints: 5,
    })

    const url = getMapsUrl({
      name: 'Jacksonville Community Center',
      address: 'Jacksonville, AL',
      lat: 33.81134863,
      lng: -85.77272482,
    })

    expect(url.startsWith('https://www.google.com/maps/')).toBe(true)
    expect(url).not.toContain('geo:')
    expect(url).toContain('33.81134863')
    expect(url).toContain('-85.77272482')
  })

  it('uses Apple Maps on iOS', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      platform: 'iPhone',
      maxTouchPoints: 5,
    })

    const url = getMapsUrl({
      name: 'Field',
      address: 'Somewhere',
      lat: 33.81,
      lng: -85.77,
    })

    expect(url.startsWith('https://maps.apple.com/')).toBe(true)
    expect(url).toContain('33.81')
    expect(url).toContain('-85.77')
  })
})
