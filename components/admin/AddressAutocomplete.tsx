'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MatchLocation } from '@/types/match'

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
  disabled,
  nameId = 'location-name',
  addressId = 'location-address',
}: AddressAutocompleteProps) {
  const sessionToken = useId().replace(/:/g, '')
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

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
    const token = getMapboxToken()
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
    const token = getMapboxToken()
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
        lat: retrievedLat,
        lng: retrievedLng,
      })
      setSuggestions([])
    } catch {
      setError('Could not resolve that address. Try another suggestion.')
    } finally {
      setLoading(false)
    }
  }

  const coordsHint =
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
      ? `Pinned: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
      : address.trim()
        ? 'Select a suggestion to pin coordinates for check-in'
        : null

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
          placeholder="e.g. Memorial Park Field 3"
          className="h-11"
        />
      </div>

      <div className="relative space-y-2">
        <Label htmlFor={addressId}>Address</Label>
        <Input
          id={addressId}
          type="text"
          value={address}
          onChange={e => handleAddressChange(e.target.value)}
          disabled={disabled}
          placeholder="Start typing an address…"
          className="h-11"
          autoComplete="off"
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-md dark:border-zinc-700 dark:bg-zinc-900">
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
        {!getMapboxToken() && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Set NEXT_PUBLIC_MAPBOX_TOKEN for address autocomplete.
          </p>
        )}
      </div>
    </div>
  )
}
