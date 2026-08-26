import { serializeMatchLocation } from '@/lib/utils/location'
import type { MatchLocation } from '@/types/match'
import type { ScheduleCadence, ScheduleSlot } from '@/types/schedule'
import { SCHEDULE_TIMEZONE } from '@/types/schedule'

const TIME_HHMM = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/

export type ScheduleInput = {
  name?: unknown
  cadence?: unknown
  interval?: unknown
  timezone?: unknown
  slots?: unknown
  active?: unknown
}

export type ValidatedScheduleFields = {
  name: string
  cadence: ScheduleCadence
  interval: number
  timezone: string
  slots: ScheduleSlot[]
  active?: boolean
}

function normalizeLocation(raw: unknown): MatchLocation | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    return { name: trimmed, address: trimmed, lat: null, lng: null }
  }
  if (typeof raw !== 'object') return null
  const loc = raw as Record<string, unknown>
  const name = typeof loc.name === 'string' ? loc.name.trim() : ''
  const address = typeof loc.address === 'string' ? loc.address.trim() : ''
  if (!name && !address) return null
  return {
    name: name || address,
    address: address || name,
    lat: typeof loc.lat === 'number' ? loc.lat : null,
    lng: typeof loc.lng === 'number' ? loc.lng : null,
  }
}

function parseSlot(raw: unknown, cadence: ScheduleCadence, index: number): ScheduleSlot | string {
  if (!raw || typeof raw !== 'object') {
    return `Slot ${index + 1} is invalid`
  }
  const s = raw as Record<string, unknown>
  const day = Number(s.day)
  if (!Number.isInteger(day)) {
    return `Slot ${index + 1} has an invalid day`
  }
  if (cadence === 'weekly' && (day < 0 || day > 6)) {
    return `Slot ${index + 1} day must be 0-6 (Sun-Sat)`
  }
  if (cadence === 'monthly' && (day < 1 || day > 28)) {
    return `Slot ${index + 1} day must be 1-28`
  }
  const time = typeof s.time === 'string' ? s.time : ''
  if (!TIME_HHMM.test(time)) {
    return `Slot ${index + 1} has an invalid time`
  }
  const id =
    typeof s.id === 'string' && s.id.trim()
      ? s.id.trim()
      : `slot_${Date.now()}_${index}`

  return {
    id,
    day,
    time,
    location: normalizeLocation(s.location),
  }
}

export function validateScheduleInput(
  body: ScheduleInput,
  options?: { partial?: boolean }
): { ok: true; value: Partial<ValidatedScheduleFields> & { name?: string; cadence?: ScheduleCadence; slots?: ScheduleSlot[] } } | { ok: false; error: string } {
  const partial = options?.partial === true
  const value: Partial<ValidatedScheduleFields> = {}

  if (body.name !== undefined || !partial) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return { ok: false, error: 'Name is required' }
    value.name = name
  }

  if (body.cadence !== undefined || !partial) {
    if (body.cadence !== 'weekly' && body.cadence !== 'monthly') {
      return { ok: false, error: 'Cadence must be weekly or monthly' }
    }
    value.cadence = body.cadence
  }

  if (body.interval !== undefined || !partial) {
    const interval =
      body.interval === undefined ? 1 : Number(body.interval)
    if (!Number.isInteger(interval) || interval < 1) {
      return { ok: false, error: 'Interval must be an integer >= 1' }
    }
    value.interval = interval
  }

  if (body.timezone !== undefined) {
    value.timezone =
      typeof body.timezone === 'string' && body.timezone.trim()
        ? body.timezone.trim()
        : SCHEDULE_TIMEZONE
  } else if (!partial) {
    value.timezone = SCHEDULE_TIMEZONE
  }

  if (body.slots !== undefined || !partial) {
    if (!Array.isArray(body.slots) || body.slots.length === 0) {
      return { ok: false, error: 'At least one slot is required' }
    }
    const cadence =
      value.cadence ??
      (body.cadence === 'monthly' || body.cadence === 'weekly'
        ? body.cadence
        : null)
    if (!cadence) {
      return { ok: false, error: 'Cadence is required to validate slots' }
    }
    const slots: ScheduleSlot[] = []
    for (let i = 0; i < body.slots.length; i++) {
      const parsed = parseSlot(body.slots[i], cadence, i)
      if (typeof parsed === 'string') return { ok: false, error: parsed }
      slots.push(parsed)
    }
    value.slots = slots
  }

  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') {
      return { ok: false, error: 'Active must be a boolean' }
    }
    value.active = body.active
  }

  return { ok: true, value }
}

export function serializeSlotsForFirestore(slots: ScheduleSlot[]) {
  return slots.map(s => ({
    id: s.id,
    day: s.day,
    time: s.time,
    location: serializeMatchLocation(s.location),
  }))
}
