import type { MatchLocation } from '@/types/match'
import { hasValidCoords } from '@/lib/utils/geo'

/**
 * Normalize Firestore location (legacy string or structured object) to MatchLocation.
 */
export function parseMatchLocation(raw: unknown): MatchLocation | null {
  if (raw == null) return null

  if (typeof raw === 'string') {
    const name = raw.trim()
    if (!name) return null
    return { name, address: name, lat: null, lng: null }
  }

  if (typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const name = typeof obj.name === 'string' ? obj.name.trim() : ''
  const address = typeof obj.address === 'string' ? obj.address.trim() : ''
  if (!name && !address) return null

  const lat = typeof obj.lat === 'number' ? obj.lat : Number(obj.lat)
  const lng = typeof obj.lng === 'number' ? obj.lng : Number(obj.lng)

  return {
    name: name || address,
    address: address || name,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  }
}

export function serializeMatchLocation(
  location: MatchLocation | null | undefined
): MatchLocation | null {
  if (!location) return null
  const name = location.name?.trim() || ''
  const address = location.address?.trim() || ''
  if (!name && !address) return null
  return {
    name: name || address,
    address: address || name,
    lat: Number.isFinite(location.lat) ? (location.lat as number) : null,
    lng: Number.isFinite(location.lng) ? (location.lng as number) : null,
  }
}

export function locationDisplayName(
  location: MatchLocation | null | undefined
): string | null {
  if (!location) return null
  const name = location.name?.trim()
  return name || location.address?.trim() || null
}

export { hasValidCoords }
