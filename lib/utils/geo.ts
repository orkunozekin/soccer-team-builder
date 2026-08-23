import type { MatchLocation } from '@/types/match'

const EARTH_RADIUS_M = 6371000

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Great-circle distance between two WGS84 points, in meters. */
export function haversineDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const CHECK_IN_RADIUS_METERS = 500
export const CHECK_IN_MAX_ACCURACY_METERS = 300

export function isWithinCheckInRadius(
  user: { lat: number; lng: number },
  venue: { lat: number; lng: number },
  radiusMeters: number = CHECK_IN_RADIUS_METERS
): boolean {
  return haversineDistanceMeters(user, venue) <= radiusMeters
}

export function hasValidCoords(
  location: Pick<MatchLocation, 'lat' | 'lng'> | null | undefined
): boolean {
  if (!location) return false
  const { lat, lng } = location
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  )
}
