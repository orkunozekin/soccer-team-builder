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

export interface MatchFirestore {
  id: string
  date: any // Firestore Timestamp
  time: string
  rsvpOpen: boolean
  rsvpOpenAt: any | null // Firestore Timestamp
  rsvpCloseAt: any | null // Firestore Timestamp
  createdAt: any // Firestore Timestamp
  updatedAt: any // Firestore Timestamp
}
