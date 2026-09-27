export type ClubMembershipRole = 'player' | 'club_admin'

export type ClubMembershipStatus = 'active'

export type ClubInviteCreatorRole = 'club_admin' | 'player' | 'super_user'

/** Optional paint for club-owned navigation. Omitted fields fall back to the club name and Soccerville red. */
export interface ClubBranding {
  /** Shown in the club switcher. Falls back to `name`. */
  displayName?: string
  /** https URL of a logo shown on the club switcher. */
  logoUrl?: string
  /** `#rrggbb` background for the club rail, switcher, and mobile club chrome. */
  primaryColor?: string
}

export interface ClubSettings {
  /** When true, players (not only club admins) may create invites. Default false. */
  allowPlayerInvites: boolean
  branding?: ClubBranding
}

export interface Club {
  id: string
  name: string
  /** Unique, URL-safe identifier */
  slug: string
  createdBy: string
  settings: ClubSettings
  createdAt: Date
  updatedAt: Date
}

export interface ClubMembership {
  id: string
  clubId: string
  userId: string
  role: ClubMembershipRole
  status: ClubMembershipStatus
  joinedAt: Date
  updatedAt: Date
}

export interface ClubInvite {
  id: string
  clubId: string
  /** Short human code; also used as the `?code=` link token */
  code: string
  createdBy: string
  createdByRole: ClubInviteCreatorRole
  maxUses: number | null
  useCount: number
  expiresAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}

/** Membership row joined with club fields for profile /mine responses */
export interface ClubMembershipWithClub extends ClubMembership {
  club: Pick<Club, 'id' | 'name' | 'slug' | 'settings'>
}

/** Membership row with user display fields for club roster */
export interface ClubMembershipWithUser extends ClubMembership {
  displayName: string
  email: string
}
