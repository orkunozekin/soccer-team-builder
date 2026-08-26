'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getAllSavedLocations } from '@/lib/services/savedLocationService'
import type { SavedLocation } from '@/types/savedLocation'

const NONE_VALUE = '__none__'

interface SavedLocationSelectProps {
  disabled?: boolean
  selectedId?: string | null
  onSelect: (location: SavedLocation | null) => void
}

export function SavedLocationSelect({
  disabled,
  selectedId,
  onSelect,
}: SavedLocationSelectProps) {
  const [locations, setLocations] = useState<SavedLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const list = await getAllSavedLocations()
        if (!cancelled) setLocations(list)
      } catch {
        if (!cancelled) {
          setError('Could not load saved locations.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const value = selectedId ?? NONE_VALUE

  return (
    <div className="space-y-2">
      <Label htmlFor="saved-location-select">Saved location</Label>
      <Select
        value={value}
        onValueChange={next => {
          if (next === NONE_VALUE) {
            onSelect(null)
            return
          }
          const location = locations.find(loc => loc.id === next) ?? null
          onSelect(location)
        }}
        disabled={disabled || loading}
      >
        <SelectTrigger id="saved-location-select" className="h-11">
          <SelectValue
            placeholder={
              loading ? 'Loading saved locations…' : 'Choose a saved location…'
            }
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>Enter location manually</SelectItem>
          {locations.map(location => (
            <SelectItem key={location.id} value={location.id}>
              {location.name}
              {location.address && location.address !== location.name
                ? ` — ${location.address}`
                : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!loading && locations.length === 0 && !error && (
        <p className="text-xs text-zinc-500">
          No saved locations yet. Add venues under Admin → Locations.
        </p>
      )}
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
