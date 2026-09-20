import type { RSVP } from '@/types/rsvp'
import type { Team } from '@/types/team'
import type { User } from '@/types/user'

/** User IDs on match teams plus confirmed RSVPs (for roster display and profile merge). */
export function collectMatchParticipantIds(
  teams: Team[],
  rsvps: RSVP[]
): string[] {
  const ids = new Set<string>()
  for (const team of teams) {
    for (const playerId of team.playerIds) {
      ids.add(playerId)
    }
  }
  for (const rsvp of rsvps) {
    if (rsvp.status === 'confirmed') {
      ids.add(rsvp.userId)
    }
  }
  return Array.from(ids)
}

/**
 * Placeholder roster entries so pitch/list can render immediately from
 * team playerIds + RSVP position/jersey before profile docs hydrate.
 */
export function buildRosterPlaceholders(
  participantIds: string[],
  rsvps: RSVP[]
): User[] {
  const rsvpByUserId = new Map(rsvps.map(r => [r.userId, r]))
  const now = new Date()
  return participantIds.map(uid => {
    const rsvp = rsvpByUserId.get(uid)
    return {
      uid,
      email: '',
      displayName: 'Player',
      jerseyNumber: rsvp?.jerseyNumber ?? null,
      position: rsvp?.position ?? null,
      role: 'user' as const,
      createdAt: now,
      updatedAt: now,
    }
  })
}

/** Prefer hydrated profiles; keep placeholders for ids still missing a profile. */
export function mergeRosterProfiles(
  placeholders: User[],
  profiles: User[]
): User[] {
  const byId = new Map(placeholders.map(u => [u.uid, u]))
  for (const profile of profiles) {
    byId.set(profile.uid, profile)
  }
  const seen = new Set<string>()
  const result: User[] = []
  for (const id of [
    ...placeholders.map(p => p.uid),
    ...profiles.map(p => p.uid),
  ]) {
    if (seen.has(id)) continue
    seen.add(id)
    const user = byId.get(id)
    if (user) result.push(user)
  }
  return result
}
