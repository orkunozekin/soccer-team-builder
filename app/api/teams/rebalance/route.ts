import { Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'
import { auditLog } from '@/lib/services/auditService'
import {
  applyPersistedTransfersKeepingBalance,
  isGoalkeeper,
} from '@/lib/utils/teamGenerator'
import type { User } from '@/types/user'

function timestampToDate(t: Timestamp | Date | null | undefined): Date | null {
  if (!t) return null
  if (t instanceof Date) return t
  return (t as Timestamp).toDate()
}

/** Split `totalPlayers` evenly across pair capacities (e.g. 14 → [7, 7]). */
function computeTargetSizes(
  totalPlayers: number,
  capacities: number[]
): number[] {
  const targets = capacities.map(() => 0)
  let remaining = totalPlayers
  let i = 0
  while (remaining > 0) {
    const idx = i % capacities.length
    if (targets[idx] < capacities[idx]) {
      targets[idx] += 1
      remaining -= 1
    }
    i += 1
    // Safety: if all targets at capacity, break.
    if (i > totalPlayers + capacities.length * 2) break
  }
  return targets
}

export async function POST(request: NextRequest) {
  try {
    const { uid, isAdmin, error: authError } = await verifyAdmin(request)
    if (authError || !uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const matchId = body?.matchId as string | undefined
    if (!matchId) {
      return NextResponse.json(
        { error: 'matchId is required' },
        { status: 400 }
      )
    }

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const teamsCol = adminDb.collection(`matches/${matchId}/teams`)

    const teamsSnap = await teamsCol.get()
    if (teamsSnap.empty) {
      return NextResponse.json(
        { error: 'No teams found for match' },
        { status: 400 }
      )
    }

    const teams = teamsSnap.docs
      .map(d => {
        const data = d.data()
        return {
          id: d.id,
          teamNumber: Number(data.teamNumber ?? 0),
          maxSize: Number(data.maxSize ?? 11),
        }
      })
      .sort((a, b) => a.teamNumber - b.teamNumber)

    const capacities = teams.map(t => t.maxSize)
    const rosterLimit = capacities.reduce((sum, n) => sum + n, 0)

    // Load confirmed RSVPs, sorted by rsvpAt asc (earliest first)
    const rsvpSnap = await adminDb
      .collection('rsvps')
      .where('matchId', '==', matchId)
      .where('status', '==', 'confirmed')
      .get()

    const rsvps = rsvpSnap.docs
      .map(d => {
        const data = d.data()
        return {
          userId: data.userId as string,
          rsvpAt: timestampToDate(data.rsvpAt) ?? new Date(0),
        }
      })
      .filter(r => !!r.userId)
      .sort((a, b) => a.rsvpAt.getTime() - b.rsvpAt.getTime())

    if (rsvps.length < 2) {
      return NextResponse.json(
        { error: 'Need at least 2 RSVPs to rebalance' },
        { status: 400 }
      )
    }

    // Build user map (position/role/etc)
    const usersSnap = await adminDb.collection('users').get()
    const users: User[] = usersSnap.docs.map(d => {
      const data = d.data()
      return {
        uid: (data.uid as string) ?? d.id,
        email: (data.email as string) ?? '',
        displayName: (data.displayName as string) ?? '',
        jerseyNumber: (data.jerseyNumber as number | null) ?? null,
        position: (data.position as string | null) ?? null,
        role: (data.role as 'user' | 'admin') ?? 'user',
        createdAt: timestampToDate(data.createdAt) || new Date(),
        updatedAt: timestampToDate(data.updatedAt) || new Date(),
      }
    })
    const userById = new Map(users.map(u => [u.uid, u]))

    // Deduplicate RSVP list by userId, keep earliest RSVP timestamp
    const earliestByUser = new Map<string, Date>()
    for (const r of rsvps) {
      const prev = earliestByUser.get(r.userId)
      if (!prev || r.rsvpAt < prev) earliestByUser.set(r.userId, r.rsvpAt)
    }

    const uniqueRsvpsSorted = Array.from(earliestByUser.entries())
      .map(([userId, rsvpAt]) => ({ userId, rsvpAt }))
      .sort((a, b) => a.rsvpAt.getTime() - b.rsvpAt.getTime())

    // Base roster: first N RSVPs by time
    const baseRoster = uniqueRsvpsSorted
      .slice(0, rosterLimit)
      .map(r => r.userId)

    // GK priority: ensure earliest goalkeepers are included, even if outside the base roster.
    const gkCandidates = uniqueRsvpsSorted
      .filter(r => isGoalkeeper(userById.get(r.userId)?.position ?? null))
      .map(r => r.userId)

    const rosterSet = new Set(baseRoster)
    const replacements: Array<{ insertedGK: string; removedPlayer: string }> =
      []

    for (const gkId of gkCandidates) {
      if (rosterSet.size >= rosterLimit && rosterSet.has(gkId)) continue
      if (rosterSet.size < rosterLimit) {
        rosterSet.add(gkId)
        continue
      }

      // Replace latest non-GK by RSVP timestamp (walk from end)
      for (let i = uniqueRsvpsSorted.length - 1; i >= 0; i--) {
        const candidateId = uniqueRsvpsSorted[i].userId
        if (!rosterSet.has(candidateId)) continue
        if (isGoalkeeper(userById.get(candidateId)?.position ?? null)) continue
        rosterSet.delete(candidateId)
        rosterSet.add(gkId)
        replacements.push({ insertedGK: gkId, removedPlayer: candidateId })
        break
      }
    }

    const roster = Array.from(rosterSet)
      .map(id => ({
        id,
        rsvpAt: earliestByUser.get(id) ?? new Date(0),
      }))
      .sort((a, b) => a.rsvpAt.getTime() - b.rsvpAt.getTime())
      .map(x => x.id)

    // Fill every team from the RSVP-sorted roster. Teams are processed in pairs
    // (1&2), (3&4), … only so each matchup gets even sizes; within a pair the
    // earlier team always gets the earlier contiguous RSVP slice (no position
    // scrambling). Example with 45 players: Team 3 = RSVPs 23–33, Team 4 = 34–44.
    const numTeams = teams.length
    const assigned: string[][] = teams.map(() => [])
    let rosterOffset = 0

    for (let p = 0; p < numTeams; p += 2) {
      const t0 = p
      const t1 = p + 1

      if (t1 < numTeams) {
        const pairCap = capacities[t0]! + capacities[t1]!
        const chunk = roster.slice(rosterOffset, rosterOffset + pairCap)
        rosterOffset += chunk.length
        const [target0, target1] = computeTargetSizes(chunk.length, [
          capacities[t0]!,
          capacities[t1]!,
        ])
        assigned[t0] = chunk.slice(0, target0)
        assigned[t1] = chunk.slice(target0, target0 + target1)
      } else {
        // Odd team: take next cap[t0] players and assign all to t0
        const cap = capacities[t0]!
        const chunk = roster.slice(rosterOffset, rosterOffset + cap)
        rosterOffset += chunk.length
        assigned[t0] = [...chunk]
      }
    }

    const baselineTeams = teams.map((t, idx) => ({
      teamNumber: t.teamNumber,
      playerIds: assigned[idx]!,
    }))

    const matchRef = adminDb.collection('matches').doc(matchId)
    const matchSnap = await matchRef.get()
    const persisted = matchSnap.exists
      ? ((matchSnap.data()?.manualTeamAssignments as
          | Record<string, number>
          | undefined) ?? {})
      : {}

    // Apply persisted admin pins only (not current-vs-baseline diffs — those
    // re-create size skew). Then move unpinned players to restore pair balance.
    const maxSizeByTeamNumber = new Map(
      teams.map(t => [t.teamNumber, t.maxSize] as const)
    )
    const finalTeams = applyPersistedTransfersKeepingBalance(
      baselineTeams,
      persisted,
      maxSizeByTeamNumber
    )
    const finalByNumber = new Map(
      finalTeams.map(t => [t.teamNumber, t.playerIds])
    )
    const finalAssigned = teams.map(
      t => finalByNumber.get(t.teamNumber) ?? []
    )

    const now = Timestamp.now()
    const batch = adminDb.batch()
    teams.forEach((t, idx) => {
      batch.update(teamsCol.doc(t.id), {
        playerIds: finalAssigned[idx],
        updatedAt: now,
      })
    })
    await batch.commit()

    // Persist GK replacements so when that GK later changes position, we can swap them with the person they replaced
    const gkReplacements: Record<string, string> = {}
    for (const r of replacements) {
      gkReplacements[r.insertedGK] = r.removedPlayer
    }
    if (Object.keys(gkReplacements).length > 0) {
      await matchRef.set({ gkReplacements, updatedAt: now }, { merge: true })
    }

    auditLog({
      action: 'team.rebalanced',
      actorUid: uid,
      matchId,
      entityType: 'team',
      source: 'api',
      metadata: {
        teamsRebalanced: teams.length,
        assignedCounts: finalAssigned.map(a => a.length),
        replacementCount: replacements.length,
      },
    })

    return NextResponse.json({
      success: true,
      teamsRebalanced: teams.length,
      assignedCounts: finalAssigned.map(a => a.length),
      benchCount: 0,
      rosterLimit,
      replacements,
    })
  } catch (error: any) {
    console.error('Error rebalancing teams:', error)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to rebalance teams') },
      { status: 500 }
    )
  }
}
