export type RSVPStatus = 'confirmed' | 'cancelled'

export interface RSVP {
  id: string
  matchId: string
  userId: string
  status: RSVPStatus
  position: string | null
  rsvpAt: Date
  updatedAt: Date
}

export interface RSVPFirestore {
  id: string
  matchId: string
  userId: string
  status: RSVPStatus
  position?: string | null
  rsvpAt: any // Firestore Timestamp
  updatedAt: any // Firestore Timestamp
}
