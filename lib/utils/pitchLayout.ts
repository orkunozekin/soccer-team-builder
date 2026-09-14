import type { RSVP } from '@/types/rsvp'
import type { Team } from '@/types/team'
import type { User } from '@/types/user'

/**
 * Position to pitch coordinates mapping.
 * Coordinates are relative (0-100%) for responsive design.
 */
export interface PitchPosition {
  x: number // 0-100, left to right
  y: number // 0-100, top to bottom
}

export interface PlayerOnPitch {
  user: User
  position: PitchPosition
  /** Slot code actually used for display (may differ from preferred on collision). */
  assignedSlot: string
  preferredPosition: string
}

export const POSITION_COORDINATES: Record<string, PitchPosition> = {
  GK: { x: 50, y: 5 },

  // Fullbacks sit wide; LCB/RCB are display-only pair slots so duplicate CBs
  // do not steal LB/RB and stack on top of real fullbacks.
  LB: { x: 6, y: 20 },
  LWB: { x: 5, y: 36 },
  LCB: { x: 30, y: 20 },
  CB: { x: 50, y: 20 },
  RCB: { x: 70, y: 20 },
  RWB: { x: 95, y: 36 },
  RB: { x: 94, y: 20 },

  CDM: { x: 50, y: 42 },
  LM: { x: 6, y: 50 },
  LCM: { x: 35, y: 50 },
  CM: { x: 50, y: 50 },
  RCM: { x: 65, y: 50 },
  RM: { x: 94, y: 50 },
  CAM: { x: 50, y: 58 },

  LW: { x: 6, y: 75 },
  CF: { x: 50, y: 80 },
  ST: { x: 50, y: 85 },
  RW: { x: 94, y: 75 },
}

/**
 * Overflow targets when preferred slot is taken (in order).
 * Display-only — never mutates stored RSVP/profile position.
 * LCB/RCB/LCM/RCM are layout-only slots (not profile position codes).
 */
export const POSITION_ADJACENCY: Record<string, string[]> = {
  GK: ['CDM', 'CB', 'CM'],
  LB: ['LWB', 'LM', 'LCB', 'CDM'],
  RB: ['RWB', 'RM', 'RCB', 'CDM'],
  CB: ['LCB', 'RCB', 'CDM', 'CM'],
  LCB: ['CB', 'LB', 'CDM', 'LWB'],
  RCB: ['CB', 'RB', 'CDM', 'RWB'],
  LWB: ['LB', 'LM', 'LW', 'LCB'],
  RWB: ['RB', 'RM', 'RW', 'RCB'],
  CDM: ['CM', 'CB', 'CAM'],
  CM: ['LCM', 'RCM', 'CDM', 'CAM'],
  LCM: ['CM', 'LM', 'CDM', 'CAM'],
  RCM: ['CM', 'RM', 'CDM', 'CAM'],
  CAM: ['CM', 'CF', 'ST', 'CDM'],
  LM: ['LW', 'LWB', 'LCM', 'CAM'],
  RM: ['RW', 'RWB', 'RCM', 'CAM'],
  LW: ['LM', 'CF', 'ST', 'LWB'],
  RW: ['RM', 'CF', 'ST', 'RWB'],
  CF: ['ST', 'CAM', 'LW', 'RW'],
  ST: ['CF', 'CAM', 'LW', 'RW'],
}

function normalizePosition(position: string | null | undefined): string {
  if (!position) return 'CM'
  const upper = position.trim().toUpperCase()
  return POSITION_COORDINATES[upper] ? upper : 'CM'
}

function slotKey(slot: string): string {
  return slot.toUpperCase()
}

function rsvpAtMs(
  userId: string,
  rsvpAtByUserId: Map<string, Date | null | undefined>
): number | null {
  const at = rsvpAtByUserId.get(userId)
  if (!at) return null
  const ms = at instanceof Date ? at.getTime() : new Date(at).getTime()
  return Number.isFinite(ms) ? ms : null
}

function compareByRsvpAt(
  aId: string,
  bId: string,
  rsvpAtByUserId: Map<string, Date | null | undefined>
): number {
  const aMs = rsvpAtMs(aId, rsvpAtByUserId)
  const bMs = rsvpAtMs(bId, rsvpAtByUserId)
  if (aMs == null && bMs == null) return 0
  if (aMs == null) return 1
  if (bMs == null) return -1
  if (aMs !== bMs) return aMs - bMs
  return aId.localeCompare(bId)
}

export function getPitchPosition(position: string | null): PitchPosition {
  if (!position) return { x: 50, y: 50 }
  return POSITION_COORDINATES[position.toUpperCase()] || { x: 50, y: 50 }
}

/**
 * Escape hatch: small horizontal nudge when all adjacent role slots are taken.
 */
export function getOffsetPosition(
  basePosition: PitchPosition,
  index: number,
  total: number
): PitchPosition {
  const offsetX = (index - (total - 1) / 2) * 8
  return {
    x: Math.max(5, Math.min(95, basePosition.x + offsetX)),
    y: basePosition.y,
  }
}

/**
 * Map a full-pitch slot into the top or bottom half for dual-team display.
 * Team 1 (top) attacks down — mirror X so the team's left (LB) is on
 * screen-right when facing the opponent.
 * Team 2 (bottom) attacks up — keep X as-is (LB on screen-left).
 */
export function mapToHalfPitch(
  position: PitchPosition,
  half: 'top' | 'bottom'
): PitchPosition {
  const scale = 0.46
  const margin = 2
  if (half === 'top') {
    return {
      x: 100 - position.x,
      y: margin + position.y * scale,
    }
  }
  return {
    x: position.x,
    y: 100 - margin - position.y * scale,
  }
}

/**
 * Count preferred positions on a team roster (match-merged user.position).
 */
export function getTeamPositionOccupancy(
  team: Team | null | undefined,
  users: User[]
): Record<string, number> {
  const counts: Record<string, number> = {}
  if (!team) return counts
  const usersById = new Map(users.map(u => [u.uid, u]))
  for (const playerId of team.playerIds) {
    const user = usersById.get(playerId)
    if (!user) continue
    const pos = normalizePosition(user.position)
    counts[pos] = (counts[pos] ?? 0) + 1
  }
  return counts
}

interface SlotCandidate {
  user: User
  preferred: string
}

/**
 * Display-only slot assignment.
 * Earliest rsvpAt claims the canonical preferred slot; later duplicates take
 * nearest free adjacent roles. Does not mutate RSVP or profile positions.
 */
export function assignPitchSlots(
  team: Team,
  users: User[],
  matchRSVPs: RSVP[] = []
): PlayerOnPitch[] {
  const usersById = new Map(users.map(u => [u.uid, u]))
  const rsvpAtByUserId = new Map(
    matchRSVPs.map(r => [r.userId, r.rsvpAt] as const)
  )

  const teamUsers = team.playerIds
    .map(id => usersById.get(id))
    .filter((u): u is User => !!u)

  const groups = new Map<string, SlotCandidate[]>()
  for (const user of teamUsers) {
    const preferred = normalizePosition(user.position)
    const list = groups.get(preferred) ?? []
    list.push({ user, preferred })
    groups.set(preferred, list)
  }

  for (const list of Array.from(groups.values())) {
    list.sort((a, b) =>
      compareByRsvpAt(a.user.uid, b.user.uid, rsvpAtByUserId)
    )
  }

  const claimedSlots = new Set<string>()
  const assignments: {
    user: User
    preferred: string
    assignedSlot: string
    position: PitchPosition
  }[] = []

  // Pass 1: earliest per preferred group claims the canonical slot.
  // Multiple CBs/CMs pair horizontally (LCB/RCB, LCM/RCM) so duplicates
  // stay on the same band instead of stacking on fullbacks or wing slots.
  const horizontalPairs: Record<string, readonly [string, string]> = {
    CB: ['LCB', 'RCB'],
    CM: ['LCM', 'RCM'],
  }

  for (const [preferred, list] of Array.from(groups.entries())) {
    const pairSlots = horizontalPairs[preferred]
    if (pairSlots && list.length >= 2) {
      const paired = Math.min(list.length, pairSlots.length)
      for (let i = 0; i < paired; i++) {
        const slot = pairSlots[i]
        claimedSlots.add(slotKey(slot))
        assignments.push({
          user: list[i].user,
          preferred,
          assignedSlot: slot,
          position: { ...getPitchPosition(slot) },
        })
      }
      continue
    }

    const earliest = list[0]
    if (!earliest) continue
    const key = slotKey(preferred)
    claimedSlots.add(key)
    assignments.push({
      user: earliest.user,
      preferred,
      assignedSlot: preferred,
      position: { ...getPitchPosition(preferred) },
    })
  }

  // Pass 2: remaining players (global rsvpAt order) take nearest free adjacent.
  const remaining: SlotCandidate[] = []
  for (const [preferred, list] of Array.from(groups.entries())) {
    const pairSlots = horizontalPairs[preferred]
    const alreadyAssigned =
      pairSlots && list.length >= 2
        ? Math.min(list.length, pairSlots.length)
        : 1
    for (let i = alreadyAssigned; i < list.length; i++) {
      remaining.push(list[i])
    }
  }
  remaining.sort((a, b) =>
    compareByRsvpAt(a.user.uid, b.user.uid, rsvpAtByUserId)
  )

  let nudgeIndex = 0
  for (const candidate of remaining) {
    const adjacent = POSITION_ADJACENCY[candidate.preferred] ?? []
    let claimed: string | null = null

    for (const slot of adjacent) {
      const key = slotKey(slot)
      if (!claimedSlots.has(key) && POSITION_COORDINATES[key]) {
        claimed = key
        break
      }
    }

    if (claimed) {
      claimedSlots.add(slotKey(claimed))
      assignments.push({
        user: candidate.user,
        preferred: candidate.preferred,
        assignedSlot: claimed,
        position: { ...getPitchPosition(claimed) },
      })
      continue
    }

    // Escape hatch: nudge near preferred (or last adjacent) coordinates.
    const fallbackSlot =
      adjacent.find(s => POSITION_COORDINATES[slotKey(s)]) ?? candidate.preferred
    const base = getPitchPosition(fallbackSlot)
    nudgeIndex += 1
    assignments.push({
      user: candidate.user,
      preferred: candidate.preferred,
      assignedSlot: fallbackSlot,
      position: getOffsetPosition(base, nudgeIndex, nudgeIndex + 1),
    })
  }

  return assignments.map(({ user, position, assignedSlot, preferred }) => ({
    user,
    position,
    assignedSlot,
    preferredPosition: preferred,
  }))
}

/**
 * Map a team's players to pitch positions using rsvpAt-priority slot assignment.
 */
export function getTeamPlayers(
  team: Team,
  users: User[],
  matchRSVPs: RSVP[] = []
): PlayerOnPitch[] {
  return assignPitchSlots(team, users, matchRSVPs)
}
