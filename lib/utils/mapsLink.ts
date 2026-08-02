import type { MatchLocation } from '@/types/match'

function googleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/**
 * Platform-friendly URL that opens maps.
 * iOS → Apple Maps; everyone else → Google Maps HTTPS
 * (geo: URIs break in desktop browsers and Chrome device emulation).
 */
export function getMapsUrl(
  location: Pick<MatchLocation, 'name' | 'address' | 'lat' | 'lng'>
): string {
  const hasCoords =
    location.lat != null &&
    location.lng != null &&
    Number.isFinite(location.lat) &&
    Number.isFinite(location.lng)
  const query = hasCoords
    ? `${location.lat},${location.lng}`
    : location.address.trim() || location.name.trim()

  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || ''
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

    if (isIOS) {
      // Prefer lat,lng as the query so Apple Maps drops a pin at exact coords
      // (campus fields often have no reliable street address).
      return hasCoords
        ? `https://maps.apple.com/?ll=${location.lat},${location.lng}&q=${location.lat},${location.lng}`
        : `https://maps.apple.com/?q=${encodeURIComponent(query)}`
    }
  }

  return googleMapsSearchUrl(query)
}
