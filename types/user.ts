export type UserRole = 'user' | 'super_user'

export type ThemePreference = 'dark' | 'light'

export interface User {
  uid: string
  email: string
  displayName: string
  jerseyNumber: number | null
  position: string | null
  role: UserRole
  /** Currently selected club for multi-club UX; optional until set */
  activeClubId?: string | null
  /** UI theme; missing means dark. */
  themePreference?: ThemePreference
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
  themePreference?: ThemePreference
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

/**
 * Anything other than an explicit `'light'` (missing, legacy, malformed)
 * resolves to dark so existing users see no change.
 */
export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === 'light' ? 'light' : 'dark'
}
