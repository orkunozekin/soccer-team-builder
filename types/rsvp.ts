export type RSVPStatus = 'confirmed' | 'cancelled'

export interface RSVP {
  id: string
  matchId: string
  userId: string
  status: RSVPStatus
  position: string | null
  /** Snapshot of the player's jersey at RSVP time (falls back to profile jersey in UI). */
  jerseyNumber: number | null
  rsvpAt: Date
  updatedAt: Date
}

export interface RSVPFirestore {
  id: string
  matchId: string
  userId: string
  status: RSVPStatus
  position?: string | null
  jerseyNumber?: number | null
  rsvpAt: any // Firestore Timestamp
  updatedAt: any // Firestore Timestamp
}
