export interface Match {
  id: string
  date: Date
  time: string // HH:mm format
  location: string | null
  rsvpOpen: boolean
  rsvpOpenAt: Date | null
  rsvpCloseAt: Date | null
  createdAt: Date
  updatedAt: Date
}
