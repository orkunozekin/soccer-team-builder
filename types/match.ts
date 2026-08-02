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
  createdAt: Date
  updatedAt: Date
}
