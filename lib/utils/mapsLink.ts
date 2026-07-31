import type { MatchLocation } from '@/types/match'

/**
 * Platform-friendly URL that opens the device default maps app.
 * Prefers lat/lng; falls back to address query.
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
    const isAndroid = /Android/i.test(ua)

    if (isIOS) {
      return hasCoords
        ? `https://maps.apple.com/?ll=${location.lat},${location.lng}&q=${encodeURIComponent(location.name || location.address)}`
        : `https://maps.apple.com/?q=${encodeURIComponent(query)}`
    }
    if (isAndroid) {
      return hasCoords
        ? `geo:${location.lat},${location.lng}?q=${location.lat},${location.lng}(${encodeURIComponent(location.name || location.address)})`
        : `geo:0,0?q=${encodeURIComponent(query)}`
    }
  }

  // Desktop / unknown: Google Maps search
  return hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
