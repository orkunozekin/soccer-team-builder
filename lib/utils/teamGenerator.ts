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
  const extraTeams =
    extraPlayers > 0 ? Math.ceil(extraPlayers / maxTeamSize) : 0
  return Math.max(baseTeams, baseTeams + extraTeams)
}

function effectivePositionForUser(
  uid: string,
  rsvpByUserId: Map<string, RSVP>,
  userById: Map<string, User>
): string | null {
  const r = rsvpByUserId.get(uid)
  const u = userById.get(uid)
  return r?.position ?? u?.position ?? null
}

/**
 * Add players from pool onto an existing roster (in RSVP order), respecting maxSize and GK cap.
 * Mutates pool. Returns the updated player IDs.
 */
function addPlayersToTeam(
  existingIds: string[],
  pool: RSVP[],
  rsvpByUserId: Map<string, RSVP>,
  userById: Map<string, User>,
  maxSize: number,
  maxGk: number
): string[] {
  const assigned = [...existingIds]
  let gkCount = assigned.filter(uid =>
    isGoalkeeper(effectivePositionForUser(uid, rsvpByUserId, userById))
  ).length
  const deferred: RSVP[] = []

  for (const rsvp of pool) {
    if (assigned.length >= maxSize) {
      deferred.push(rsvp)
      continue
    }
    const isGk = isGoalkeeper(
      effectivePositionForUser(rsvp.userId, rsvpByUserId, userById)
    )
    if (isGk && gkCount >= maxGk) {
      deferred.push(rsvp)
      continue
    }
    assigned.push(rsvp.userId)
    if (isGk) gkCount += 1
  }

  pool.length = 0
  pool.push(...deferred)
  return assigned
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
    const user = users.find(u => u.uid === rsvp.userId)
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
 * Place only unassigned RSVPs onto existing teams without reshuffling outfield players
 * among already-full teams. Then shift GKs from later teams onto any earlier team that
 * still has no goalkeeper (same priority rule as full regeneration).
 */
export function assignUnassignedPlayersToTeams(
  existingTeams: TeamAssignment[],
  unassignedRsvps: RSVP[],
  allRsvps: RSVP[],
  users: User[],
  maxTeamSize: number = 11,
  teamCount: number
): { teams: TeamAssignment[]; gkReplacements: GkReplacement[] } {
  const userById = new Map(users.map(u => [u.uid, u]))
  const rsvpByUserId = new Map(allRsvps.map(r => [r.userId, r]))

  const teams = existingTeams
    .map(t => ({ teamNumber: t.teamNumber, playerIds: [...t.playerIds] }))
    .sort((a, b) => a.teamNumber - b.teamNumber)

  while (teams.length < teamCount) {
    teams.push({ teamNumber: teams.length + 1, playerIds: [] })
  }

  const pool = [...unassignedRsvps]
    .filter(r => users.some(u => u.uid === r.userId))
    .sort((a, b) => (a.rsvpAt?.getTime() ?? 0) - (b.rsvpAt?.getTime() ?? 0))

  for (const team of teams) {
    if (pool.length === 0) break
    const maxGk = team.teamNumber <= 2 ? 1 : maxTeamSize
    team.playerIds = addPlayersToTeam(
      team.playerIds,
      pool,
      rsvpByUserId,
      userById,
      maxTeamSize,
      maxGk
    )
  }

  return shiftGoalkeepersOntoTeamsWithoutGk(teams, allRsvps, users)
}

/**
 * For each team that has no GK, move the earliest-RSVP GK from a later team onto it
 * via shift-down (bumped players cascade toward the GK's former team).
 */
export function shiftGoalkeepersOntoTeamsWithoutGk(
  existingTeams: TeamAssignment[],
  rsvps: RSVP[],
  users: User[]
): { teams: TeamAssignment[]; gkReplacements: GkReplacement[] } {
  const teams = existingTeams
    .map(t => ({ teamNumber: t.teamNumber, playerIds: [...t.playerIds] }))
    .sort((a, b) => a.teamNumber - b.teamNumber)

  const userById = new Map(users.map(u => [u.uid, u]))
  const rsvpByUserId = new Map(rsvps.map(r => [r.userId, r]))
  const rsvpAtByUserId = new Map(
    rsvps.map(r => [r.userId, r.rsvpAt?.getTime() ?? 0])
  )
  const effectivePosition = (uid: string): string | null => {
    const r = rsvpByUserId.get(uid)
    const u = userById.get(uid)
    return r?.position ?? u?.position ?? null
  }

  const gkReplacements: GkReplacement[] = []
  const teamHasGk = (t: TeamAssignment) =>
    t.playerIds.some(uid => isGoalkeeper(effectivePosition(uid)))
  const insertedGkIds = new Set<string>()

  const lastByRsvp = (
    playerIds: string[],
    nonGkOnly: boolean
  ): string | null => {
    const withRsvp = playerIds
      .filter(uid => !nonGkOnly || !isGoalkeeper(effectivePosition(uid)))
      .map(uid => ({ uid, rsvpAt: rsvpAtByUserId.get(uid) ?? 0 }))
      .sort((a, b) => b.rsvpAt - a.rsvpAt)
    return withRsvp[0]?.uid ?? null
  }

  const teamSortedByRsvp = (playerIds: string[]): string[] =>
    [...playerIds].sort(
      (a, b) => (rsvpAtByUserId.get(a) ?? 0) - (rsvpAtByUserId.get(b) ?? 0)
    )

  const lastNonGkByRsvp = (playerIds: string[]): string | null => {
    const nonGks = playerIds.filter(
      uid => !isGoalkeeper(effectivePosition(uid))
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

    const gkTeamIndex = teams.findIndex(t => t.playerIds.includes(gkId))
    if (gkTeamIndex < 0 || gkTeamIndex <= targetTi) continue

    const p0 = lastByRsvp(teams[targetTi].playerIds, false)
    if (!p0) continue

    teams[targetTi].playerIds = teams[targetTi].playerIds.map(id =>
      id === p0 ? gkId : id
    )

    let bumped: string = p0

    for (let i = targetTi + 1; i < gkTeamIndex; i++) {
      const sorted = teamSortedByRsvp(teams[i].playerIds)
      const pushOff = lastNonGkByRsvp(teams[i].playerIds)
      if (!pushOff) break
      teams[i].playerIds = [bumped, ...sorted.filter(uid => uid !== pushOff)]
      bumped = pushOff
    }

    const gkTeamWithoutGk = teams[gkTeamIndex].playerIds.filter(
      id => id !== gkId
    )
    teams[gkTeamIndex].playerIds = [
      bumped,
      ...teamSortedByRsvp(gkTeamWithoutGk),
    ]

    gkReplacements.push({ insertedGK: gkId, removedPlayer: p0 })
    insertedGkIds.add(gkId)
  }

  return { teams, gkReplacements }
}

/**
 * Players whose current team differs from a fresh RSVP-order baseline are treated as
 * explicit admin transfers and should be preserved across regeneration.
 */
export function deriveManualTransfers(
  currentTeams: TeamAssignment[],
  baselineTeams: TeamAssignment[]
): Map<string, number> {
  const baselineTeamByUser = new Map<string, number>()
  for (const team of baselineTeams) {
    for (const userId of team.playerIds) {
      baselineTeamByUser.set(userId, team.teamNumber)
    }
  }

  const manual = new Map<string, number>()
  for (const team of currentTeams) {
    for (const userId of team.playerIds) {
      const baselineTeam = baselineTeamByUser.get(userId)
      if (baselineTeam !== undefined && baselineTeam !== team.teamNumber) {
        manual.set(userId, team.teamNumber)
      }
    }
  }
  return manual
}

/** Re-apply explicit team overrides onto a freshly generated baseline roster. */
export function applyManualTeamTransfers(
  baselineTeams: TeamAssignment[],
  manualTransfers: Map<string, number>
): TeamAssignment[] {
  if (manualTransfers.size === 0) {
    return baselineTeams.map(t => ({
      teamNumber: t.teamNumber,
      playerIds: [...t.playerIds],
    }))
  }

  const teams = baselineTeams.map(t => ({
    teamNumber: t.teamNumber,
    playerIds: [...t.playerIds],
  }))

  const ensureTeam = (teamNumber: number): TeamAssignment => {
    let team = teams.find(t => t.teamNumber === teamNumber)
    if (!team) {
      team = { teamNumber, playerIds: [] }
      teams.push(team)
      teams.sort((a, b) => a.teamNumber - b.teamNumber)
    }
    return team
  }

  manualTransfers.forEach((targetTeamNumber, userId) => {
    for (const team of teams) {
      team.playerIds = team.playerIds.filter(id => id !== userId)
    }
    const target = ensureTeam(targetTeamNumber)
    if (!target.playerIds.includes(userId)) {
      target.playerIds.push(userId)
    }
  })

  return teams
}

export function mergeManualTransfers(
  fromDiff: Map<string, number>,
  persisted?: Record<string, number>
): Map<string, number> {
  const merged = new Map(fromDiff)
  if (!persisted) return merged
  for (const [userId, teamNumber] of Object.entries(persisted)) {
    if (typeof teamNumber === 'number' && Number.isFinite(teamNumber)) {
      merged.set(userId, teamNumber)
    }
  }
  return merged
}

/** Re-apply manual transfers onto a fresh baseline (rebalance or regenerate). */
export function mergeBaselineWithManualTransfers(
  currentTeams: TeamAssignment[],
  baselineTeams: TeamAssignment[],
  persistedManualAssignments?: Record<string, number>
): TeamAssignment[] {
  const manualTransfers = mergeManualTransfers(
    deriveManualTransfers(currentTeams, baselineTeams),
    persistedManualAssignments
  )
  return applyManualTeamTransfers(baselineTeams, manualTransfers)
}

function computePairTargetSizes(
  totalPlayers: number,
  capacities: [number, number]
): [number, number] {
  const targets: [number, number] = [0, 0]
  let remaining = totalPlayers
  let i = 0
  while (remaining > 0) {
    const idx = (i % 2) as 0 | 1
    if (targets[idx] < capacities[idx]) {
      targets[idx] += 1
      remaining -= 1
    }
    i += 1
    if (i > totalPlayers + 4) break
  }
  return targets
}

/**
 * Rebalance path: apply only persisted admin pins onto a fresh balanced baseline,
 * then restore pair sizes by moving players who are not pinned to their current team.
 *
 * Unlike mergeBaselineWithManualTransfers, this does NOT treat the current skewed
 * roster as implied transfers (that undoes rebalance). Size-neutral swaps stay;
 * one-way pins stay on their preferred team while unpinned players fill the gap.
 */
export function applyPersistedTransfersKeepingBalance(
  baselineTeams: TeamAssignment[],
  persistedManualAssignments: Record<string, number> | undefined,
  maxSizeByTeamNumber: Map<number, number>
): TeamAssignment[] {
  const manualPins = mergeManualTransfers(new Map(), persistedManualAssignments)
  const teams = applyManualTeamTransfers(baselineTeams, manualPins).sort(
    (a, b) => a.teamNumber - b.teamNumber
  )

  for (let p = 0; p < teams.length; p += 2) {
    const t0 = teams[p]
    const t1 = teams[p + 1]
    if (!t0 || !t1) break

    const cap0 = maxSizeByTeamNumber.get(t0.teamNumber) ?? 11
    const cap1 = maxSizeByTeamNumber.get(t1.teamNumber) ?? 11
    const total = t0.playerIds.length + t1.playerIds.length
    const [target0, target1] = computePairTargetSizes(total, [cap0, cap1])

    const moveUnpinned = (
      from: TeamAssignment,
      to: TeamAssignment
    ): boolean => {
      const idx = from.playerIds.findIndex(
        id => manualPins.get(id) !== from.teamNumber
      )
      if (idx < 0) return false
      const [playerId] = from.playerIds.splice(idx, 1)
      if (!playerId) return false
      to.playerIds.push(playerId)
      return true
    }

    while (
      t0.playerIds.length > target0 &&
      t1.playerIds.length < target1
    ) {
      if (!moveUnpinned(t0, t1)) break
    }
    while (
      t1.playerIds.length > target1 &&
      t0.playerIds.length < target0
    ) {
      if (!moveUnpinned(t1, t0)) break
    }
  }

  return teams
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
  const pool = sorted.filter(r => users.some(u => u.uid === r.userId))

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

  // If we needed more teams by count but had no overflow, add empty slots
  while (teams.length < teamCount) {
    teams.push({ teamNumber: teams.length + 1, playerIds: [] })
  }

  return shiftGoalkeepersOntoTeamsWithoutGk(teams, sorted, users)
}
