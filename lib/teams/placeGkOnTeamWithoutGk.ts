/**
 * Server-only: When a user updates their RSVP position to GK and they're not on
 * one of the first two teams (e.g. they RSVP'd after the initial 22), place them
 * on a team that has no GK by replacing the last person on that team (by RSVP time).
 * Bumped players cascade through intermediate full teams (shift-down) so the 22nd
 * RSVP lands on team 3+ instead of leaving team 1/2 with 12 players.
 * Only considers the first two teams; if both already have a GK, no placement.
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore'
import { Timestamp } from 'firebase-admin/firestore'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'

const TEAM_COLORS = [
  '#f97316',
  '#3b82f6',
  '#eab308',
  '#65a30d',
  '#ef4444',
  '#8b5cf6',
]
const TEAM_NAMES = ['Orange', 'Blue', 'Yellow', 'Lime', 'Red', 'Purple']

interface TeamDoc {
  id: string
  ref: DocumentReference
  teamNumber: number
  playerIds: string[]
  maxSize: number
}

/**
 * Place userId (new GK) on the first of teams 1 or 2 that has no GK, replacing the
 * last-added player on that team (by rsvpAt). Cascade the bumped player through
 * later teams via shift-down. If both of the first two teams already have a GK,
 * does nothing.
 * Removes userId from their current team if they're on one; sets match gkReplacements
 * so swapping back when they change position later works.
 */
export async function placeGkOnTeamWithoutGk(
  adminDb: Firestore,
  matchId: string,
  userId: string,
  rsvpPositionsByUserId: Map<string, string | null>,
  userPositionsByUserId: Map<string, string | null>
): Promise<{ placed: boolean; replacedUserId?: string; teamNumber?: number }> {
  const teamsCol = adminDb.collection(`matches/${matchId}/teams`)
  const teamsSnap = await teamsCol.orderBy('teamNumber').get()
  const teams: TeamDoc[] = teamsSnap.docs.map(d => {
    const data = d.data()
    return {
      id: d.id,
      ref: d.ref,
      teamNumber: (data.teamNumber as number) ?? 0,
      playerIds: [...((data.playerIds as string[]) ?? [])],
      maxSize: (data.maxSize as number) ?? 11,
    }
  })

  const firstTwoTeams = teams
    .filter(t => t.teamNumber === 1 || t.teamNumber === 2)
    .sort((a, b) => a.teamNumber - b.teamNumber)
  if (firstTwoTeams.length === 0) return { placed: false }

  const userAlreadyOnFirstTwo = firstTwoTeams.some(t =>
    t.playerIds.includes(userId)
  )
  if (userAlreadyOnFirstTwo) return { placed: false }

  const teamHasGk = (playerIds: string[]) =>
    playerIds.some(id =>
      isGoalkeeper(
        rsvpPositionsByUserId.get(id) ?? userPositionsByUserId.get(id) ?? null
      )
    )

  let targetTeam: TeamDoc | null = null
  for (const t of firstTwoTeams) {
    if (t.playerIds.length > 0 && !teamHasGk(t.playerIds)) {
      targetTeam = t
      break
    }
  }
  if (!targetTeam) return { placed: false }

  const rsvpsSnap = await adminDb
    .collection('rsvps')
    .where('matchId', '==', matchId)
    .where('status', '==', 'confirmed')
    .get()

  const rsvpAtByUserId = new Map<string, Date>()
  rsvpsSnap.docs.forEach(d => {
    const data = d.data()
    const uid = data.userId as string
    const rsvpAt = data.rsvpAt?.toDate?.() ?? new Date(0)
    rsvpAtByUserId.set(uid, rsvpAt)
  })

  const lastByRsvp = (playerIds: string[]): string | null => {
    const sorted = [...playerIds].sort((a, b) => {
      const at = rsvpAtByUserId.get(b)?.getTime() ?? 0
      const bt = rsvpAtByUserId.get(a)?.getTime() ?? 0
      return at - bt
    })
    return sorted[0] ?? null
  }

  const lastNonGkByRsvp = (playerIds: string[]): string | null => {
    const nonGks = playerIds.filter(
      id =>
        !isGoalkeeper(
          rsvpPositionsByUserId.get(id) ??
            userPositionsByUserId.get(id) ??
            null
        )
    )
    return lastByRsvp(nonGks)
  }

  const teamSortedByRsvp = (playerIds: string[]): string[] =>
    [...playerIds].sort(
      (a, b) =>
        (rsvpAtByUserId.get(a)?.getTime() ?? 0) -
        (rsvpAtByUserId.get(b)?.getTime() ?? 0)
    )

  const lastOnTeam = lastByRsvp(targetTeam.playerIds)
  if (!lastOnTeam) return { placed: false }

  const now = Timestamp.now()

  // Remove GK from wherever they currently sit (usually team 3+).
  for (const t of teams) {
    if (t.playerIds.includes(userId)) {
      t.playerIds = t.playerIds.filter(id => id !== userId)
      break
    }
  }

  // Replace last-on-target with the new GK (size-neutral on target).
  targetTeam.playerIds = targetTeam.playerIds.map(id =>
    id === lastOnTeam ? userId : id
  )

  // Shift-down cascade through intermediate teams toward team 3+.
  let bumped: string = lastOnTeam
  const teamsByNumber = [...teams].sort((a, b) => a.teamNumber - b.teamNumber)
  const targetIndex = teamsByNumber.findIndex(t => t.id === targetTeam!.id)

  for (let i = targetIndex + 1; i < teamsByNumber.length; i++) {
    const team = teamsByNumber[i]
    if (!team) break

    if (team.teamNumber >= 3) {
      if (!team.playerIds.includes(bumped)) {
        team.playerIds = [...team.playerIds, bumped]
      }
      bumped = ''
      break
    }

    // Teams 1/2: if under capacity, just add; otherwise push off latest non-GK.
    if (team.playerIds.length < team.maxSize) {
      if (!team.playerIds.includes(bumped)) {
        team.playerIds = [...team.playerIds, bumped]
      }
      bumped = ''
      break
    }

    const pushOff = lastNonGkByRsvp(team.playerIds)
    if (!pushOff) {
      // Cannot cascade further without removing a GK; fall through to create team 3.
      break
    }
    const sorted = teamSortedByRsvp(team.playerIds)
    team.playerIds = [bumped, ...sorted.filter(uid => uid !== pushOff)]
    bumped = pushOff
  }

  if (bumped) {
    const existingOverflow = teamsByNumber.find(
      t => t.teamNumber >= 3 && t.playerIds.length < t.maxSize
    )
    if (existingOverflow) {
      if (!existingOverflow.playerIds.includes(bumped)) {
        existingOverflow.playerIds = [...existingOverflow.playerIds, bumped]
      }
    } else {
      const nextTeamNumber =
        teams.length > 0 ? Math.max(...teams.map(t => t.teamNumber)) + 1 : 3
      const newRef = teamsCol.doc()
      const newTeam: TeamDoc = {
        id: newRef.id,
        ref: newRef,
        teamNumber: nextTeamNumber,
        playerIds: [bumped],
        maxSize: 11,
      }
      teams.push(newTeam)
    }
  }

  // Persist all team roster changes.
  const originalTeamIds = new Set(teamsSnap.docs.map(d => d.id))
  const writes: Promise<unknown>[] = []
  for (const t of teams) {
    if (originalTeamIds.has(t.id)) {
      writes.push(
        t.ref.update({ playerIds: t.playerIds, updatedAt: now })
      )
    } else {
      writes.push(
        t.ref.set({
          matchId,
          teamNumber: t.teamNumber,
          name:
            TEAM_NAMES[(t.teamNumber - 1) % TEAM_NAMES.length] ??
            `Team ${t.teamNumber}`,
          color:
            TEAM_COLORS[(t.teamNumber - 1) % TEAM_COLORS.length] ?? '#3b82f6',
          playerIds: t.playerIds,
          maxSize: 11,
          createdAt: now,
          updatedAt: now,
        })
      )
    }
  }

  const matchRef = adminDb.collection('matches').doc(matchId)
  const matchSnap = await matchRef.get()
  const existing = matchSnap.exists
    ? ((matchSnap.data()?.gkReplacements as
        | Record<string, string>
        | undefined) ?? {})
    : {}
  writes.push(
    matchRef.set(
      {
        gkReplacements: { ...existing, [userId]: lastOnTeam },
        updatedAt: now,
      },
      { merge: true }
    )
  )

  await Promise.all(writes)

  return {
    placed: true,
    replacedUserId: lastOnTeam,
    teamNumber: targetTeam.teamNumber,
  }
}
