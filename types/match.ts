export interface MatchLocation {
  /** Display label, e.g. "Memorial Park Field 3" */
  name: string
  /** Full address used for geocoding / maps fallback */
  address: string
  /** null until geocoded / selected from autocomplete */
  lat: number | null
  lng: number | null
}

export interface Match {
  id: string
  date: Date
  time: string // HH:mm format
  location: MatchLocation | null
  rsvpOpen: boolean
  rsvpOpenAt: Date | null
  rsvpCloseAt: Date | null
  /** When set, match is soft-deleted and hidden from normal listings. */
  deletedAt?: Date | null
  /** Present when this match was created from a recurring schedule. */
  scheduleId?: string | null
  scheduleSlotId?: string | null
  /** Stable key e.g. "sched_x:slot_y:2026-09-01" */
  scheduleOccurrenceKey?: string | null
  createdAt: Date
  updatedAt: Date
}
