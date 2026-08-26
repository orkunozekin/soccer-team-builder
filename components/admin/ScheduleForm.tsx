'use client'

import { useState } from 'react'
import { LocationPicker } from '@/components/admin/LocationPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { MatchLocation } from '@/types/match'
import type {
  MatchSchedule,
  ScheduleCadence,
  ScheduleSlot,
} from '@/types/schedule'

const WEEKDAY_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
] as const

type SlotDraft = {
  key: string
  id?: string
  day: number
  time: string
  locationName: string
  address: string
  lat: number | null
  lng: number | null
}

function newSlotDraft(day = 1): SlotDraft {
  return {
    key: `new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    day,
    time: '19:00',
    locationName: '',
    address: '',
    lat: null,
    lng: null,
  }
}

function slotToDraft(slot: ScheduleSlot): SlotDraft {
  return {
    key: slot.id,
    id: slot.id,
    day: slot.day,
    time: slot.time,
    locationName: slot.location?.name ?? '',
    address: slot.location?.address ?? '',
    lat: slot.location?.lat ?? null,
    lng: slot.location?.lng ?? null,
  }
}

function draftToSlotPayload(draft: SlotDraft) {
  const name = draft.locationName.trim()
  const addr = draft.address.trim()
  const location: MatchLocation | null =
    name || addr
      ? {
          name: name || addr,
          address: addr || name,
          lat: draft.lat,
          lng: draft.lng,
        }
      : null

  return {
    ...(draft.id ? { id: draft.id } : {}),
    day: draft.day,
    time: draft.time,
    location,
  }
}

export type ScheduleFormValues = {
  name: string
  cadence: ScheduleCadence
  interval: number
  slots: ReturnType<typeof draftToSlotPayload>[]
  active: boolean
}

interface ScheduleFormProps {
  initial?: MatchSchedule | null
  submitLabel: string
  onSubmit: (values: ScheduleFormValues) => Promise<void>
  onCancel?: () => void
}

export function ScheduleForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: ScheduleFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [cadence, setCadence] = useState<ScheduleCadence>(
    initial?.cadence ?? 'weekly'
  )
  const [interval, setInterval] = useState(String(initial?.interval ?? 1))
  const [active, setActive] = useState(initial?.active ?? false)
  const [slots, setSlots] = useState<SlotDraft[]>(
    initial?.slots?.length
      ? initial.slots.map(slotToDraft)
      : [newSlotDraft(1), newSlotDraft(3), newSlotDraft(0)]
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const updateSlot = (key: string, patch: Partial<SlotDraft>) => {
    setSlots(prev => prev.map(s => (s.key === key ? { ...s, ...patch } : s)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const intervalNum = Number(interval)
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (!Number.isInteger(intervalNum) || intervalNum < 1) {
      setError('Interval must be a whole number >= 1')
      return
    }
    if (slots.length === 0) {
      setError('Add at least one slot')
      return
    }

    setLoading(true)
    try {
      await onSubmit({
        name: name.trim(),
        cadence,
        interval: intervalNum,
        slots: slots.map(draftToSlotPayload),
        active,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schedule')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="schedule-name">Name</Label>
        <Input
          id="schedule-name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Club weekly games"
          disabled={loading}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Cadence</Label>
          <Select
            value={cadence}
            onValueChange={v => setCadence(v as ScheduleCadence)}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="schedule-interval">
            Every N {cadence === 'weekly' ? 'weeks' : 'months'}
          </Label>
          <Input
            id="schedule-interval"
            type="number"
            min={1}
            step={1}
            value={interval}
            onChange={e => setInterval(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={active}
          onChange={e => setActive(e.target.checked)}
          disabled={loading}
          className="h-4 w-4 rounded border-zinc-300"
        />
        Active (keep next 3 matches created automatically)
      </label>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Slots
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() =>
              setSlots(prev => [
                ...prev,
                newSlotDraft(cadence === 'weekly' ? 1 : 1),
              ])
            }
          >
            Add slot
          </Button>
        </div>

        {slots.map((slot, index) => (
          <div
            key={slot.key}
            className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Slot {index + 1}
              </p>
              {slots.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={loading}
                  onClick={() =>
                    setSlots(prev => prev.filter(s => s.key !== slot.key))
                  }
                >
                  Remove
                </Button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  {cadence === 'weekly' ? 'Day of week' : 'Day of month (1-28)'}
                </Label>
                {cadence === 'weekly' ? (
                  <Select
                    value={String(slot.day)}
                    onValueChange={v =>
                      updateSlot(slot.key, { day: Number(v) })
                    }
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAY_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={slot.day}
                    onChange={e =>
                      updateSlot(slot.key, {
                        day: Number(e.target.value) || 1,
                      })
                    }
                    disabled={loading}
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={slot.time}
                  onChange={e => updateSlot(slot.key, { time: e.target.value })}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <LocationPicker
              key={slot.key}
              locationName={slot.locationName}
              address={slot.address}
              lat={slot.lat}
              lng={slot.lng}
              disabled={loading}
              nameId={`slot-name-${slot.key}`}
              addressId={`slot-address-${slot.key}`}
              onLocationNameChange={nameVal =>
                updateSlot(slot.key, { locationName: nameVal })
              }
              onAddressTextChange={addr =>
                updateSlot(slot.key, { address: addr })
              }
              onAddressSelect={loc =>
                updateSlot(slot.key, {
                  locationName: loc.name || slot.locationName,
                  address: loc.address,
                  lat: loc.lat,
                  lng: loc.lng,
                })
              }
              onPinChange={coords =>
                updateSlot(slot.key, {
                  lat: coords?.lat ?? null,
                  lng: coords?.lng ?? null,
                })
              }
            />
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : submitLabel}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
