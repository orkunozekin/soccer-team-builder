'use client'

import { useEffect, useId, useState } from 'react'
import { SavedLocationForm } from '@/components/admin/SavedLocationManager'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  const [createOpen, setCreateOpen] = useState(false)
  // Unique per instance: forms like ScheduleForm render one picker per slot.
  const selectId = useId()

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

  const handleCreated = (location: SavedLocation) => {
    setLocations(prev => {
      if (prev.some(item => item.id === location.id)) {
        return prev
      }
      return [...prev, location].sort((a, b) => a.name.localeCompare(b.name))
    })
    onSelect(location)
    setCreateOpen(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={selectId}>Saved location</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-1 text-sm"
          onClick={() => setCreateOpen(true)}
          disabled={disabled}
        >
          Add location
        </Button>
      </div>
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
        <SelectTrigger id={selectId} className="h-11">
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
                ? ` - ${location.address}`
                : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!loading && locations.length === 0 && !error && (
        <p className="text-xs text-muted-foreground">
          No saved locations yet. Add one to reuse it on future matches.
        </p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add saved location</DialogTitle>
            <DialogDescription>
              Save this venue so you can reuse it when creating or editing
              matches.
            </DialogDescription>
          </DialogHeader>
          {createOpen && (
            <SavedLocationForm
              onSaved={handleCreated}
              onCancel={() => setCreateOpen(false)}
              nameId="picker-new-location-name"
              addressId="picker-new-location-address"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
