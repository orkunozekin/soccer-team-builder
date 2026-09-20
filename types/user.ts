export type UserRole = 'user' | 'super_user'

export interface User {
  uid: string
  email: string
  displayName: string
  jerseyNumber: number | null
  position: string | null
  role: UserRole
  /** Currently selected club for multi-club UX; optional until set */
  activeClubId?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface UserFirestore {
  uid: string
  email: string
  emailLower?: string
  displayName: string
  displayNameLower?: string
  jerseyNumber: number | null
  position: string | null
  role: UserRole
  activeClubId?: string | null
  createdAt: any // Firestore Timestamp
  updatedAt: any // Firestore Timestamp
}

/**
 * Normalize legacy `admin` docs to `super_user` until backfill completes.
 */
export function normalizeUserRole(role: unknown): UserRole {
  if (role === 'admin' || role === 'super_user') return 'super_user'
  return 'user'
}
