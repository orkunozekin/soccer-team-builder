'use client'

import { useEffect, useId, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MatchLocation } from '@/types/match'

const LocationMapPicker = dynamic(
  () =>
    import('@/components/admin/LocationMapPicker').then(m => m.LocationMapPicker),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-56 items-center justify-center rounded-md border border-dashed border-zinc-300 text-xs text-zinc-500 sm:h-64">
        Loading map…
      </div>
    ),
  }
)

interface AddressSuggestion {
  mapbox_id: string
  name: string
  full_address?: string
  place_formatted?: string
}

interface AddressAutocompleteProps {
  locationName: string
  address: string
  lat: number | null
  lng: number | null
  onLocationNameChange: (name: string) => void
  onAddressSelect: (loc: Omit<MatchLocation, 'name'> & { name?: string }) => void
  onAddressTextChange: (address: string) => void
  onPinChange: (coords: { lat: number; lng: number } | null) => void
  disabled?: boolean
  nameId?: string
  addressId?: string
}

function getMapboxToken(): string {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || ''
}

export function AddressAutocomplete({
  locationName,
  address,
  lat,
  lng,
  onLocationNameChange,
  onAddressSelect,
  onAddressTextChange,
  onPinChange,
  disabled,
  nameId = 'location-name',
  addressId = 'location-address',
}: AddressAutocompleteProps) {
  const sessionToken = useId().replace(/:/g, '')
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reverseLoading, setReverseLoading] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reverseReqRef = useRef(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const token = getMapboxToken()

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const fetchSuggestions = async (query: string) => {
    if (!token || query.trim().length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        q: query.trim(),
        access_token: token,
        session_token: sessionToken,
        limit: '5',
        types: 'address,poi,place',
      })
      const res = await fetch(
        `https://api.mapbox.com/search/searchbox/v1/suggest?${params}`
      )
      if (!res.ok) {
        throw new Error('Address search failed')
      }
      const data = await res.json()
      const list = (data.suggestions ?? []) as AddressSuggestion[]
      setSuggestions(list)
      setOpen(list.length > 0)
    } catch {
      setError('Could not search addresses. Check Mapbox token.')
      setSuggestions([])
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  const handleAddressChange = (value: string) => {
    onAddressTextChange(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300)
  }

  const handleSelect = async (suggestion: AddressSuggestion) => {
    if (!token) return

    setOpen(false)
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        access_token: token,
        session_token: sessionToken,
      })
      const res = await fetch(
        `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(suggestion.mapbox_id)}?${params}`
      )
      if (!res.ok) throw new Error('Failed to retrieve address')
      const data = await res.json()
      const feature = data.features?.[0]
      const coords = feature?.geometry?.coordinates
      const props = feature?.properties ?? {}
      const fullAddress =
        (props.full_address as string) ||
        suggestion.full_address ||
        suggestion.place_formatted ||
        suggestion.name
      const retrievedLng = Array.isArray(coords) ? Number(coords[0]) : NaN
      const retrievedLat = Array.isArray(coords) ? Number(coords[1]) : NaN

      onAddressSelect({
        address: fullAddress,
        lat: Number.isFinite(retrievedLat) ? retrievedLat : null,
        lng: Number.isFinite(retrievedLng) ? retrievedLng : null,
      })
      setSuggestions([])
    } catch {
      setError('Could not resolve that address. Try another suggestion.')
    } finally {
      setLoading(false)
    }
  }

  const reverseGeocode = async (nextLat: number, nextLng: number) => {
    if (!token) return

    const reqId = ++reverseReqRef.current
    setReverseLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        access_token: token,
        limit: '1',
        types: 'address,poi,place',
      })
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${nextLng},${nextLat}.json?${params}`
      )
      if (!res.ok) throw new Error('Reverse geocode failed')
      const data = (await res.json()) as {
        features?: Array<{ place_name?: string }>
      }
      const placeName = data.features?.[0]?.place_name
      if (reqId !== reverseReqRef.current) return
      if (placeName) {
        onAddressTextChange(placeName)
      }
    } catch {
      if (reqId !== reverseReqRef.current) return
      // Pin is still saved; address fill is best-effort.
      setError('Could not look up an address for that pin.')
    } finally {
      if (reqId === reverseReqRef.current) {
        setReverseLoading(false)
      }
    }
  }

  const handlePinChange = (coords: { lat: number; lng: number } | null) => {
    onPinChange(coords)
    if (!coords) {
      reverseReqRef.current += 1
      setReverseLoading(false)
      return
    }
    void reverseGeocode(coords.lat, coords.lng)
  }

  const hasPin =
    lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)

  const coordsHint = reverseLoading
    ? 'Looking up address for pin…'
    : hasPin
      ? `Pinned: ${lat!.toFixed(5)}, ${lng!.toFixed(5)} (used for maps + check-in)`
      : address.trim()
        ? 'No pin yet — select a suggestion or click the map'
        : 'Optional address search, or pin the field on the map'

  return (
    <div className="space-y-4" ref={wrapRef}>
      <div className="space-y-2">
        <Label htmlFor={nameId}>Location name</Label>
        <Input
          id={nameId}
          type="text"
          value={locationName}
          onChange={e => onLocationNameChange(e.target.value)}
          disabled={disabled}
          placeholder="e.g. Rec Sports Field 4"
          className="h-11"
        />
      </div>

      <div className="relative space-y-2">
        <Label htmlFor={addressId}>Address (optional)</Label>
        <Input
          id={addressId}
          type="text"
          value={address}
          onChange={e => handleAddressChange(e.target.value)}
          disabled={disabled}
          placeholder="Search an address, or skip and pin on the map…"
          className="h-11"
          autoComplete="off"
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-md dark:border-zinc-700 dark:bg-zinc-900">
            {suggestions.map(s => (
              <li key={s.mapbox_id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  onClick={() => handleSelect(s)}
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {s.name}
                  </span>
                  {(s.place_formatted || s.full_address) && (
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {s.full_address || s.place_formatted}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {loading && (
          <p className="text-xs text-zinc-500">Searching addresses…</p>
        )}
        {coordsHint && !loading && (
          <p className="text-xs text-zinc-500">{coordsHint}</p>
        )}
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      {token ? (
        <LocationMapPicker
          token={token}
          lat={lat}
          lng={lng}
          disabled={disabled}
          onPinChange={handlePinChange}
        />
      ) : (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Set NEXT_PUBLIC_MAPBOX_TOKEN for address search and map pinning.
        </p>
      )}
    </div>
  )
}
