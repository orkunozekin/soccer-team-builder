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
  // Process from highest team index down to 0 so a GK from overflow goes to the closest team (e.g. team 2 before team 1).
  // When moving a GK from team G to team T (G > T), do a CASCADE: GK → team T (bump T's last);
  // bumped player from T → team T+1 (bump T+1's last non-GK); ...; last bumped → team G (GK's vacated spot).
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

  for (let targetTi = teams.length - 1; targetTi >= 0; targetTi--) {
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

    // Cascade: team targetTi gets GK; team targetTi's last → targetTi+1; ...; team gkTeamIndex-1's last non-GK → gkTeamIndex (GK's spot).
    const chain: string[] = []
    const p0 = lastByRsvp(teams[targetTi].playerIds, false)
    if (!p0) continue
    chain[targetTi] = p0
    for (let i = targetTi + 1; i < gkTeamIndex; i++) {
      const pi = lastByRsvp(teams[i].playerIds, true)
      if (!pi) break
      chain[i] = pi
    }
    const lastBumped = chain[gkTeamIndex - 1] ?? chain[targetTi]
    if (!lastBumped) continue

    // Apply cascade: targetTi: replace chain[targetTi] with GK; i in [targetTi+1, gkTeamIndex-1]: replace chain[i] with chain[i-1]; gkTeamIndex: replace GK with lastBumped.
    teams[targetTi].playerIds = teams[targetTi].playerIds.map((id) =>
      id === chain[targetTi] ? gkId : id
    )
    for (let i = targetTi + 1; i < gkTeamIndex; i++) {
      const prev = chain[i - 1]
      const curr = chain[i]
      if (prev != null && curr != null) {
        teams[i].playerIds = teams[i].playerIds.map((id) =>
          id === curr ? prev : id
        )
      }
    }
    teams[gkTeamIndex].playerIds = teams[gkTeamIndex].playerIds.map((id) =>
      id === gkId ? lastBumped : id
    )

    gkReplacements.push({ insertedGK: gkId, removedPlayer: chain[targetTi] })
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
