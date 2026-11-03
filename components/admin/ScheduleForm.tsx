'use client'

import { type ReactNode, useState } from 'react'
import { format } from 'date-fns'
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
import { TimePicker } from '@/components/ui/time-picker'
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

/** Header line for a slot card, e.g. "Monday · 7:00 PM". */
function describeSlot(slot: SlotDraft, cadence: ScheduleCadence): string {
  const day =
    cadence === 'weekly'
      ? (WEEKDAY_OPTIONS.find(opt => opt.value === String(slot.day))?.label ??
        '')
      : `Day ${slot.day}`
  const [hours, minutes] = slot.time.split(':').map(Number)
  const time =
    Number.isFinite(hours) && Number.isFinite(minutes)
      ? format(new Date(2000, 0, 1, hours, minutes), 'h:mm a')
      : slot.time
  return [day, time].filter(Boolean).join(' · ')
}

function FormSection({
  step,
  title,
  description,
  action,
  children,
}: {
  step: string
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}) {
  const headingId = `schedule-section-${step}`
  return (
    <section
      aria-labelledby={headingId}
      className="space-y-5 rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-xs tracking-[0.14em] text-lime">
            {step}
          </p>
          <h3
            id={headingId}
            className="font-display text-xl font-extrabold uppercase text-foreground"
          >
            {title}
          </h3>
          <p className="text-sm text-fog">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
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
    <form onSubmit={handleSubmit} className="form-field-labels space-y-6">
      <FormSection
        step="01"
        title="Schedule details"
        description="What the schedule is called and how often it repeats."
      >
        <div className="space-y-2">
          <Label htmlFor="schedule-name">Schedule name</Label>
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
            <Label htmlFor="schedule-cadence">Repeats</Label>
            <Select
              value={cadence}
              onValueChange={v => setCadence(v as ScheduleCadence)}
              disabled={loading}
            >
              <SelectTrigger id="schedule-cadence">
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
              Every how many {cadence === 'weekly' ? 'weeks' : 'months'}
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

        <label className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
          <input
            type="checkbox"
            checked={active}
            onChange={e => setActive(e.target.checked)}
            disabled={loading}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-input"
          />
          <span className="space-y-1">
            <span className="block text-sm font-semibold text-foreground">
              Active
            </span>
            <span className="block text-sm text-fog">
              Keep the next 3 matches created automatically.
            </span>
          </span>
        </label>
      </FormSection>

      <FormSection
        step="02"
        title="Match slots"
        description={
          cadence === 'weekly'
            ? 'Each slot is one match every cycle: a weekday, kickoff time and field.'
            : 'Each slot is one match every cycle: a day of the month, kickoff time and field.'
        }
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => setSlots(prev => [...prev, newSlotDraft()])}
          >
            Add slot
          </Button>
        }
      >
        <ol className="space-y-4">
          {slots.map((slot, index) => (
            <li
              key={slot.key}
              aria-label={`Slot ${index + 1}`}
              className="space-y-4 rounded-xl border border-border bg-background p-4"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                <p className="flex items-baseline gap-2">
                  <span className="font-display text-base font-extrabold uppercase text-foreground">
                    Slot {index + 1}
                  </span>
                  <span className="text-sm text-fog">
                    {describeSlot(slot, cadence)}
                  </span>
                </p>
                {slots.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={loading}
                    aria-label={`Remove slot ${index + 1}`}
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
                  <Label htmlFor={`slot-day-${slot.key}`}>
                    {cadence === 'weekly'
                      ? 'Day of week'
                      : 'Day of month (1-28)'}
                  </Label>
                  {cadence === 'weekly' ? (
                    <Select
                      value={String(slot.day)}
                      onValueChange={v =>
                        updateSlot(slot.key, { day: Number(v) })
                      }
                      disabled={loading}
                    >
                      <SelectTrigger id={`slot-day-${slot.key}`}>
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
                      id={`slot-day-${slot.key}`}
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
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={`slot-time-${slot.key}`}>Kickoff time</Label>
                  <TimePicker
                    id={`slot-time-${slot.key}`}
                    value={slot.time}
                    onChange={next => updateSlot(slot.key, { time: next })}
                    disabled={loading}
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
            </li>
          ))}
        </ol>
      </FormSection>

      {error && (
        <p className="text-sm text-red-400" role="alert">
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
