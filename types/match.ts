export interface Match {
  id: string
  date: Date
  time: string // HH:mm format
  rsvpOpen: boolean
  rsvpOpenAt: Date | null
  rsvpCloseAt: Date | null
  createdAt: Date
  updatedAt: Date
}
