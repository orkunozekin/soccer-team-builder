export type RSVPStatus = 'confirmed' | 'cancelled'
export type CheckInMethod = 'geo' | 'host'

export interface RSVP {
  id: string
  matchId: string
  userId: string
  status: RSVPStatus
  position: string | null
  /** Snapshot of the player's jersey at RSVP time (falls back to profile jersey in UI). */
  jerseyNumber: number | null
  /** null until checked in (or still pending) */
  attended: boolean | null
  checkedInAt: Date | null
  checkInMethod: CheckInMethod | null
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
  attended?: boolean | null
  checkedInAt?: any
  checkInMethod?: CheckInMethod | null
  rsvpAt: any // Firestore Timestamp
  updatedAt: any // Firestore Timestamp
}
