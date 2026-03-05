import { RSVP } from '@/types/rsvp'
import { User } from '@/types/user'

/**
 * Helper function to check if position is goalkeeper
 * Handles 'GK', 'Goalkeeper', case variations
 */
export function isGoalkeeper(position: string | null): boolean {
  if (!position) return false
  const normalized = position.toUpperCase().trim()
  const gkPositions = ['GK', 'GOALKEEPER', 'GOALIE', 'KEEPER']
  return gkPositions.includes(normalized) || normalized.includes('GOALKEEPER')
}

export interface TeamAssignment {
  teamNumber: number
  playerIds: string[]
}

export interface GkReplacement {
  insertedGK: string
  removedPlayer: string
}

export function computeTeamCountForRSVPCount(
  rsvpCount: number,
  maxTeamSize: number = 11,
  baseTeams: number = 2
): number {
  const baseCapacity = baseTeams * maxTeamSize
  const extraPlayers = Math.max(0, rsvpCount - baseCapacity)
  const extraTeams = extraPlayers > 0 ? Math.ceil(extraPlayers / maxTeamSize) : 0
  return Math.max(baseTeams, baseTeams + extraTeams)
}

/**
 * Fill one team with up to maxSize players from the pool (in order), with at most one GK.
 * Mutates pool (splice). Returns the player IDs assigned.
 */
function fillTeam(
  pool: RSVP[],
  users: User[],
  maxSize: number,
  maxGk: number = 1
): string[] {
  const assigned: string[] = []
  let gkCount = 0
  const deferred: RSVP[] = []

  for (const rsvp of pool) {
    if (assigned.length >= maxSize) {
      deferred.push(rsvp)
      continue
    }
    const user = users.find((u) => u.uid === rsvp.userId)
    const effectivePosition = rsvp.position ?? user?.position ?? null
    const isGk = isGoalkeeper(effectivePosition)
    if (isGk && gkCount >= maxGk) {
      deferred.push(rsvp)
      continue
    }
    assigned.push(rsvp.userId)
    if (isGk) gkCount += 1
  }

  // Put deferred back at the start of pool for next team (replace pool contents)
  pool.length = 0
  pool.push(...deferred)
  return assigned
}

export function generateTeams(
  rsvps: RSVP[],
  users: User[],
  maxTeamSize: number = 11,
  options?: { teamCount?: number }
): TeamAssignment[] {
  return generateTeamsWithReplacements(rsvps, users, maxTeamSize, options).teams
}

/**
 * Same as generateTeams but also returns gkReplacements.
 * For any team (1, 2, 3, …) that has no GK: the earliest RSVPing GK from a higher-indexed team is moved into that team, and that team's last non-GK (by RSVP) is bumped to the GK's former team.
 * No global GK cap.
 */
export function generateTeamsWithReplacements(
  rsvps: RSVP[],
  users: User[],
  maxTeamSize: number = 11,
  options?: { teamCount?: number }
): { teams: TeamAssignment[]; gkReplacements: GkReplacement[] } {
  const teamCount =
    options?.teamCount ?? Math.max(2, Math.ceil(rsvps.length / maxTeamSize))

  // Sort by RSVP time (earliest first)
  const sorted = [...rsvps].sort(
    (a, b) => (a.rsvpAt?.getTime() ?? 0) - (b.rsvpAt?.getTime() ?? 0)
  )
  const pool = sorted.filter((r) => users.some((u) => u.uid === r.userId))

  const teams: TeamAssignment[] = []

  // First teams (1 or 2): up to 11 each, max 1 GK per team (keep 11 v 11 when 2 teams)
  const initialTeamCount = Math.min(2, teamCount)
  for (let i = 0; i < initialTeamCount && pool.length > 0; i++) {
    const playerIds = fillTeam(pool, users, maxTeamSize, 1)
    teams.push({ teamNumber: i + 1, playerIds })
  }

  // Remaining players go to third team and beyond (extra teams; skip when only 1 team desired)
  let teamNumber = 3
  while (pool.length > 0 && teams.length < teamCount) {
    const playerIds = fillTeam(pool, users, maxTeamSize, 11) // no GK limit on extra teams
    teams.push({ teamNumber, playerIds })
    teamNumber += 1
  }

  const userById = new Map(users.map((u) => [u.uid, u]))
  const rsvpByUserId = new Map(sorted.map((r) => [r.userId, r]))
  const rsvpAtByUserId = new Map(
    sorted.map((r) => [r.userId, r.rsvpAt?.getTime() ?? 0])
  )
  const effectivePosition = (uid: string): string | null => {
    const r = rsvpByUserId.get(uid)
    const u = userById.get(uid)
    return (r?.position ?? u?.position ?? null) ?? null
  }

  // For each team that has no GK, take the earliest GK by RSVP from a later team.
  // Process from team 1 upward (low to high).
  // SHIFT-DOWN: When moving a GK from team G to team T (G > T), the bumped person (T's last by RSVP)
  // goes to the FIRST spot (earliest RSVP slot) on the next team; that team shifts down (insert at front,
  // push off last non-GK to preserve GK spot); repeat until the last bumped fills the GK's vacated spot on G.
  const gkReplacements: GkReplacement[] = []
  const teamHasGk = (t: TeamAssignment) =>
    t.playerIds.some((uid) => isGoalkeeper(effectivePosition(uid)))
  const insertedGkIds = new Set<string>()

  const lastByRsvp = (playerIds: string[], nonGkOnly: boolean): string | null => {
    const withRsvp = playerIds
      .filter((uid) => !nonGkOnly || !isGoalkeeper(effectivePosition(uid)))
      .map((uid) => ({ uid, rsvpAt: rsvpAtByUserId.get(uid) ?? 0 }))
      .sort((a, b) => b.rsvpAt - a.rsvpAt)
    return withRsvp[0]?.uid ?? null
  }

  /** Team's player IDs in RSVP order (earliest first). */
  const teamSortedByRsvp = (playerIds: string[]): string[] =>
    [...playerIds].sort(
      (a, b) => (rsvpAtByUserId.get(a) ?? 0) - (rsvpAtByUserId.get(b) ?? 0)
    )

  /** Last non-GK by RSVP (latest RSVP among non-GKs) so we keep GK on the team when pushing someone off. */
  const lastNonGkByRsvp = (playerIds: string[]): string | null => {
    const nonGks = playerIds.filter(
      (uid) => !isGoalkeeper(effectivePosition(uid))
    )
    if (nonGks.length === 0) return null
    return lastByRsvp(nonGks, false)
  }

  for (let targetTi = 0; targetTi < teams.length; targetTi++) {
    if (teamHasGk(teams[targetTi])) continue

    const laterTeams = teams.slice(targetTi + 1)
    const gksLater: { uid: string; rsvpAt: number }[] = []
    for (const t of laterTeams) {
      for (const uid of t.playerIds) {
        if (!isGoalkeeper(effectivePosition(uid))) continue
        if (insertedGkIds.has(uid)) continue
        gksLater.push({ uid, rsvpAt: rsvpAtByUserId.get(uid) ?? 0 })
      }
    }
    if (gksLater.length === 0) continue
    gksLater.sort((a, b) => a.rsvpAt - b.rsvpAt)
    const gkId = gksLater[0].uid

    const gkTeamIndex = teams.findIndex((t) => t.playerIds.includes(gkId))
    if (gkTeamIndex < 0 || gkTeamIndex <= targetTi) continue

    // Shift-down: target team gets GK (bump its last by RSVP); bumped goes to first spot on next team, etc.
    const p0 = lastByRsvp(teams[targetTi].playerIds, false)
    if (!p0) continue

    // 1. Target team: replace p0 with GK
    teams[targetTi].playerIds = teams[targetTi].playerIds.map((id) =>
      id === p0 ? gkId : id
    )

    let bumped: string = p0

    // 2. Middle teams (targetTi+1 .. gkTeamIndex-1): insert bumped at first spot, push off last non-GK
    for (let i = targetTi + 1; i < gkTeamIndex; i++) {
      const sorted = teamSortedByRsvp(teams[i].playerIds)
      const pushOff = lastNonGkByRsvp(teams[i].playerIds)
      if (!pushOff) break
      teams[i].playerIds = [bumped, ...sorted.filter((uid) => uid !== pushOff)]
      bumped = pushOff
    }

    // 3. GK's team: fill GK's spot with the last bumped
    teams[gkTeamIndex].playerIds = teams[gkTeamIndex].playerIds.map((id) =>
      id === gkId ? bumped : id
    )

    gkReplacements.push({ insertedGK: gkId, removedPlayer: p0 })
    insertedGkIds.add(gkId)
  }

  // Admins who RSVP'd after the first 22: swap them into the first two teams by replacing the last non-admin(s) by RSVP time
  if (teams.length >= 3) {
    const overflowTeams = teams.slice(2)
    const overflowAdminIds: string[] = []
    for (const t of overflowTeams) {
      for (const uid of t.playerIds) {
        if (userById.get(uid)?.role === 'admin') {
          overflowAdminIds.push(uid)
        }
      }
    }
    overflowAdminIds.sort(
      (a, b) => (rsvpAtByUserId.get(a) ?? 0) - (rsvpAtByUserId.get(b) ?? 0)
    )

    const firstTwoNonAdmins: { userId: string; teamIndex: number }[] = []
    for (let ti = 0; ti < 2 && ti < teams.length; ti++) {
      for (const uid of teams[ti].playerIds) {
        if (userById.get(uid)?.role !== 'admin') {
          firstTwoNonAdmins.push({ userId: uid, teamIndex: ti })
        }
      }
    }
    firstTwoNonAdmins.sort(
      (a, b) =>
        (rsvpAtByUserId.get(b.userId) ?? 0) - (rsvpAtByUserId.get(a.userId) ?? 0)
    )

    const swapCount = Math.min(overflowAdminIds.length, firstTwoNonAdmins.length)
    for (let i = 0; i < swapCount; i++) {
      const adminId = overflowAdminIds[i]
      const { userId: bumpedId, teamIndex } = firstTwoNonAdmins[i]

      const mainTeam = teams[teamIndex]
      mainTeam.playerIds = mainTeam.playerIds.map((id) =>
        id === bumpedId ? adminId : id
      )

      const overflowTeam = overflowTeams.find((t) =>
        t.playerIds.includes(adminId)
      )
      if (overflowTeam) {
        overflowTeam.playerIds = overflowTeam.playerIds.map((id) =>
          id === adminId ? bumpedId : id
        )
      }
    }
  }

  // If we needed more teams by count but had no overflow, add empty slots
  while (teams.length < teamCount) {
    teams.push({ teamNumber: teams.length + 1, playerIds: [] })
  }

  return { teams, gkReplacements }
}
