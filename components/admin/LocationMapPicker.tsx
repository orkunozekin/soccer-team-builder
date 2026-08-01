'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Button } from '@/components/ui/button'

const DEFAULT_CENTER: [number, number] = [-85.7614, 33.8137] // Jacksonville, AL
const DEFAULT_ZOOM = 14
const PINNED_ZOOM = 17

interface LocationMapPickerProps {
  token: string
  lat: number | null
  lng: number | null
  disabled?: boolean
  onPinChange: (coords: { lat: number; lng: number } | null) => void
}

function hasCoords(lat: number | null, lng: number | null): boolean {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  )
}

/**
 * Admin-only Mapbox map: click (or drag marker) to pin exact field coordinates.
 */
export function LocationMapPicker({
  token,
  lat,
  lng,
  disabled,
  onPinChange,
}: LocationMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const onPinChangeRef = useRef(onPinChange)
  const disabledRef = useRef(disabled)

  useEffect(() => {
    onPinChangeRef.current = onPinChange
  }, [onPinChange])

  useEffect(() => {
    disabledRef.current = disabled
  }, [disabled])

  useEffect(() => {
    if (!containerRef.current || !token) return

    mapboxgl.accessToken = token
    const startHasPin = hasCoords(lat, lng)
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: startHasPin ? [lng!, lat!] : DEFAULT_CENTER,
      zoom: startHasPin ? PINNED_ZOOM : DEFAULT_ZOOM,
      attributionControl: true,
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    const placeMarker = (nextLat: number, nextLng: number, fly: boolean) => {
      if (!mapRef.current) return
      if (markerRef.current) {
        markerRef.current.setLngLat([nextLng, nextLat])
      } else {
        const marker = new mapboxgl.Marker({
          draggable: !disabledRef.current,
          color: '#CC0000',
        })
          .setLngLat([nextLng, nextLat])
          .addTo(mapRef.current)
        marker.on('dragend', () => {
          const pos = marker.getLngLat()
          onPinChangeRef.current({ lat: pos.lat, lng: pos.lng })
        })
        markerRef.current = marker
      }
      if (fly) {
        mapRef.current.flyTo({
          center: [nextLng, nextLat],
          zoom: Math.max(mapRef.current.getZoom(), PINNED_ZOOM),
        })
      }
    }

    if (startHasPin) {
      placeMarker(lat!, lng!, false)
    }

    const onClick = (e: mapboxgl.MapMouseEvent) => {
      if (disabledRef.current) return
      const { lat: clickLat, lng: clickLng } = e.lngLat
      placeMarker(clickLat, clickLng, false)
      onPinChangeRef.current({ lat: clickLat, lng: clickLng })
    }
    map.on('click', onClick)

    // Resize after layout settles (card expand / dialog)
    const resizeTimer = window.setTimeout(() => map.resize(), 100)

    return () => {
      window.clearTimeout(resizeTimer)
      map.off('click', onClick)
      markerRef.current?.remove()
      markerRef.current = null
      map.remove()
      mapRef.current = null
    }
    // Intentionally mount once per token; pin sync handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Sync external lat/lng (e.g. address autocomplete) onto the map
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!hasCoords(lat, lng)) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }

    if (markerRef.current) {
      const current = markerRef.current.getLngLat()
      if (
        Math.abs(current.lat - lat!) > 1e-7 ||
        Math.abs(current.lng - lng!) > 1e-7
      ) {
        markerRef.current.setLngLat([lng!, lat!])
        map.flyTo({
          center: [lng!, lat!],
          zoom: Math.max(map.getZoom(), PINNED_ZOOM),
        })
      }
      markerRef.current.setDraggable(!disabled)
      return
    }

    const marker = new mapboxgl.Marker({
      draggable: !disabled,
      color: '#CC0000',
    })
      .setLngLat([lng!, lat!])
      .addTo(map)
    marker.on('dragend', () => {
      const pos = marker.getLngLat()
      onPinChangeRef.current({ lat: pos.lat, lng: pos.lng })
    })
    markerRef.current = marker
    map.flyTo({
      center: [lng!, lat!],
      zoom: Math.max(map.getZoom(), PINNED_ZOOM),
    })
  }, [lat, lng, disabled])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Pin on map
        </p>
        {hasCoords(lat, lng) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onPinChange(null)}
          >
            Clear pin
          </Button>
        )}
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Optional. Click the map (or drag the pin) to set exact coordinates.
        The nearest address fills in automatically; coords still win for maps
        links and check-in.
      </p>
      <div
        ref={containerRef}
        className="h-56 w-full overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700 sm:h-64"
        aria-label="Map to pin match location"
      />
    </div>
  )
}
