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

/** Keep markers inset from the touchline; labels may overflow the pitch edge. */
export const PITCH_EDGE_MARGIN_X = 14
export const PITCH_EDGE_MARGIN_Y = 5

export const POSITION_COORDINATES: Record<string, PitchPosition> = {
  GK: { x: 50, y: 5 },

  // Fullbacks / wing-backs sit wide but inset from the touchline so names
  // do not clip. LCB/RCB are display-only pair slots so duplicate CBs
  // do not steal LB/RB and stack on top of real fullbacks.
  LB: { x: 16, y: 16 },
  LWB: { x: 14, y: 30 },
  LCB: { x: 34, y: 16 },
  CB: { x: 50, y: 16 },
  RCB: { x: 66, y: 16 },
  RWB: { x: 86, y: 30 },
  RB: { x: 84, y: 16 },

  // Central spine: keep ST short of midfield so opposing strikers do not collide,
  // while still leaving label room between CDM/CM/CAM/ST.
  // LCDM/RCDM, LCAM/RCAM, LCF/RCF, LST/RST are display-only pair slots so
  // duplicate CDM/CAM/CF/ST sit side-by-side instead of stacking vertically.
  LCDM: { x: 38, y: 28 },
  CDM: { x: 50, y: 28 },
  RCDM: { x: 62, y: 28 },
  LM: { x: 16, y: 46 },
  LCM: { x: 35, y: 46 },
  CM: { x: 50, y: 46 },
  RCM: { x: 65, y: 46 },
  RM: { x: 84, y: 46 },
  LCAM: { x: 38, y: 62 },
  CAM: { x: 50, y: 62 },
  RCAM: { x: 62, y: 62 },

  LW: { x: 16, y: 76 },
  LCF: { x: 38, y: 78 },
  CF: { x: 50, y: 78 },
  RCF: { x: 62, y: 78 },
  LST: { x: 38, y: 82 },
  ST: { x: 50, y: 82 },
  RST: { x: 62, y: 82 },
  RW: { x: 84, y: 76 },
}

/**
 * Overflow targets when preferred slot is taken (in order).
 * Display-only — never mutates stored RSVP/profile position.
 * LCB/RCB/LCM/RCM/LCDM/RCDM/LCAM/RCAM/LCF/RCF/LST/RST are layout-only slots.
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
  CDM: ['LCDM', 'RCDM', 'CM', 'CB', 'CAM'],
  LCDM: ['CDM', 'LCM', 'CB', 'CAM'],
  RCDM: ['CDM', 'RCM', 'CB', 'CAM'],
  CM: ['LCM', 'RCM', 'CDM', 'CAM'],
  LCM: ['CM', 'LM', 'CDM', 'CAM'],
  RCM: ['CM', 'RM', 'CDM', 'CAM'],
  CAM: ['LCAM', 'RCAM', 'CM', 'CF', 'ST', 'CDM'],
  LCAM: ['CAM', 'LCM', 'CF', 'CDM'],
  RCAM: ['CAM', 'RCM', 'CF', 'CDM'],
  LM: ['LW', 'LWB', 'LCM', 'CAM'],
  RM: ['RW', 'RWB', 'RCM', 'CAM'],
  LW: ['LM', 'CF', 'ST', 'LWB'],
  RW: ['RM', 'CF', 'ST', 'RWB'],
  CF: ['LCF', 'RCF', 'ST', 'CAM', 'LW', 'RW'],
  LCF: ['CF', 'LST', 'CAM', 'LW'],
  RCF: ['CF', 'RST', 'CAM', 'RW'],
  ST: ['LST', 'RST', 'CF', 'CAM', 'LW', 'RW'],
  LST: ['ST', 'LCF', 'CAM', 'LW'],
  RST: ['ST', 'RCF', 'CAM', 'RW'],
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
 * Escape hatch: small 2D nudge when all adjacent role slots are taken.
 */
export function getOffsetPosition(
  basePosition: PitchPosition,
  index: number,
  total: number
): PitchPosition {
  const col = index % 3
  const row = Math.floor(index / 3)
  const offsetX = (col - ((total - 1) % 3) / 2) * 10
  const offsetY = row * 8
  return {
    x: Math.max(
      PITCH_EDGE_MARGIN_X,
      Math.min(100 - PITCH_EDGE_MARGIN_X, basePosition.x + offsetX)
    ),
    y: Math.max(
      PITCH_EDGE_MARGIN_Y,
      Math.min(100 - PITCH_EDGE_MARGIN_Y, basePosition.y + offsetY)
    ),
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
  // Use most of each half so vertical stacks (CDM/CM/CAM/ST) keep
  // enough gap for name labels under each marker.
  const scale = 0.49
  const margin = 1
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

export interface SeparatePlayersOptions {
  minX?: number
  maxX?: number
  minY?: number
  maxY?: number
  /** Minimum horizontal gap between marker centers (%). */
  minSepX?: number
  /** Minimum vertical gap between marker centers (%). */
  minSepY?: number
  iterations?: number
}

/**
 * Push markers apart so nodes and name labels do not overlap.
 * Uses an elliptical minimum-distance model (wider than tall) because
 * names sit under nodes and need horizontal clearance.
 */
export function separatePlayers(
  players: PlayerOnPitch[],
  options: SeparatePlayersOptions = {}
): PlayerOnPitch[] {
  if (players.length === 0) return players

  const minX = options.minX ?? PITCH_EDGE_MARGIN_X
  const maxX = options.maxX ?? 100 - PITCH_EDGE_MARGIN_X
  const minY = options.minY ?? PITCH_EDGE_MARGIN_Y
  const maxY = options.maxY ?? 100 - PITCH_EDGE_MARGIN_Y
  const minSepX = options.minSepX ?? 15
  const minSepY = options.minSepY ?? 11
  const iterations = options.iterations ?? 50

  const clamp = (pos: PitchPosition): PitchPosition => ({
    x: Math.max(minX, Math.min(maxX, pos.x)),
    y: Math.max(minY, Math.min(maxY, pos.y)),
  })

  if (players.length === 1) {
    return [{ ...players[0], position: clamp(players[0].position) }]
  }

  const positions = players.map(p => clamp(p.position))

  for (let iter = 0; iter < iterations; iter++) {
    let moved = false

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i]
        const b = positions[j]
        let dx = b.x - a.x
        let dy = b.y - a.y

        if (dx === 0 && dy === 0) {
          dx = (i % 2 === 0 ? 1 : -1) * 0.35
          dy = 0.35
        }

        const nx = dx / minSepX
        const ny = dy / minSepY
        const dist2 = nx * nx + ny * ny
        if (dist2 >= 1) continue

        const dist = Math.sqrt(dist2)
        const push = ((1 - dist) / 2) * 0.85
        let ux = (nx / dist) * push * minSepX
        let uy = (ny / dist) * push * minSepY

        // Same preferred role (e.g. two STs) should stay on one horizontal band.
        if (players[i].preferredPosition === players[j].preferredPosition) {
          ux *= 1.2
          uy *= 0.2
        }

        a.x = Math.max(minX, Math.min(maxX, a.x - ux))
        a.y = Math.max(minY, Math.min(maxY, a.y - uy))
        b.x = Math.max(minX, Math.min(maxX, b.x + ux))
        b.y = Math.max(minY, Math.min(maxY, b.y + uy))
        moved = true
      }
    }

    if (!moved) break
  }

  return players.map((p, i) => ({
    ...p,
    position: clamp(positions[i]),
  }))
}

/**
 * Assign slots, optionally map to a dual-pitch half, then separate overlaps.
 */
export function layoutTeamOnPitch(
  team: Team,
  users: User[],
  matchRSVPs: RSVP[] = [],
  half?: 'top' | 'bottom'
): PlayerOnPitch[] {
  let players = assignPitchSlots(team, users, matchRSVPs)

  if (half) {
    players = players.map(p => ({
      ...p,
      position: mapToHalfPitch(p.position, half),
    }))
    return separatePlayers(players, {
      minX: PITCH_EDGE_MARGIN_X,
      maxX: 100 - PITCH_EDGE_MARGIN_X,
      // Keep bottom-half markers inset so jersey discs stay on the grass;
      // name labels may intentionally overflow past the pitch edge.
      minY: half === 'top' ? 3 : 52,
      maxY: half === 'top' ? 48 : 94,
      // Half-pitch is vertically compressed; keep enough room for names.
      minSepX: 14,
      minSepY: 9,
    })
  }

  return separatePlayers(players)
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

  const teamUsers = team.playerIds.map(id => {
    const existing = usersById.get(id)
    if (existing) return existing
    // Profile hydration can lag or fail; still place a marker from RSVP data.
    const rsvp = matchRSVPs.find(r => r.userId === id)
    return {
      uid: id,
      email: '',
      displayName: 'Player',
      jerseyNumber: rsvp?.jerseyNumber ?? null,
      position: rsvp?.position ?? null,
      role: 'user' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies User
  })

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
  // Multiple players at the same central role pair horizontally so
  // duplicates stay on one band (e.g. two STs side-by-side, not stacked).
  const horizontalPairs: Record<string, readonly [string, string]> = {
    CB: ['LCB', 'RCB'],
    CDM: ['LCDM', 'RCDM'],
    CM: ['LCM', 'RCM'],
    CAM: ['LCAM', 'RCAM'],
    CF: ['LCF', 'RCF'],
    ST: ['LST', 'RST'],
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
  return layoutTeamOnPitch(team, users, matchRSVPs)
}
