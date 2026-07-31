import { describe, expect, it } from 'vitest'
import {
  CHECK_IN_RADIUS_METERS,
  haversineDistanceMeters,
  hasValidCoords,
  isWithinCheckInRadius,
} from './geo'

describe('geo', () => {
  it('haversineDistanceMeters is ~0 for the same point', () => {
    const p = { lat: 30.2672, lng: -97.7431 }
    expect(haversineDistanceMeters(p, p)).toBeLessThan(0.01)
  })

  it('haversineDistanceMeters approximates known short distance', () => {
    // ~111m north of origin at equator-ish; use Austin coords ~100m apart
    const a = { lat: 30.2672, lng: -97.7431 }
    const b = { lat: 30.2681, lng: -97.7431 } // ~100m north
    const d = haversineDistanceMeters(a, b)
    expect(d).toBeGreaterThan(90)
    expect(d).toBeLessThan(120)
  })

  it('isWithinCheckInRadius uses default 150m', () => {
    const venue = { lat: 30.2672, lng: -97.7431 }
    const near = { lat: 30.2675, lng: -97.7431 } // ~33m
    const far = { lat: 30.27, lng: -97.7431 } // ~311m
    expect(isWithinCheckInRadius(near, venue)).toBe(true)
    expect(isWithinCheckInRadius(far, venue)).toBe(false)
    expect(CHECK_IN_RADIUS_METERS).toBe(150)
  })

  it('hasValidCoords rejects NaN and out-of-range', () => {
    expect(hasValidCoords({ lat: 30, lng: -97 })).toBe(true)
    expect(hasValidCoords({ lat: Number.NaN, lng: -97 })).toBe(false)
    expect(hasValidCoords({ lat: 91, lng: 0 })).toBe(false)
    expect(hasValidCoords(null)).toBe(false)
  })
})
