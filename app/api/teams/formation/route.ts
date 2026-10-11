import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { verifyClubAdminForMatch } from '@/lib/api/auth'
import { getFormationById, isFormationId } from '@/lib/constants/formations'
import { getAdminDb } from '@/lib/firebase/admin'
import { auditLog } from '@/lib/services/auditService'
import { getUsersByIdsAdmin } from '@/lib/users/getUsersByIdsAdmin'
import { assignPlayersToFormation } from '@/lib/utils/assignFormationPositions'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const matchId = body?.matchId as string | undefined
    const formationId = body?.formationId as string | undefined

    if (!matchId) {
      return NextResponse.json(
        { error: 'matchId is required' },
        { status: 400 }
      )
    }
    if (!formationId || !isFormationId(formationId)) {
      return NextResponse.json(
        { error: 'Valid formationId is required' },
        { status: 400 }
      )
    }

    const formation = getFormationById(formationId)
    if (!formation) {
      return NextResponse.json(
        { error: 'Formation not found' },
        { status: 400 }
      )
    }

    const {
      uid,
      isClubAdmin,
      error: authError,
      matchExists,
    } = await verifyClubAdminForMatch(request, matchId)
    if (authError || !uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!matchExists) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }
    if (!isClubAdmin) {
      return NextResponse.json(
        { error: 'Club admin privileges required' },
        { status: 403 }
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
          playerIds: (data.playerIds as string[]) ?? [],
        }
      })
      .sort((a, b) => a.teamNumber - b.teamNumber)

    const allPlayerIds = Array.from(
      new Set(teams.flatMap(t => t.playerIds).filter(Boolean))
    )
    if (allPlayerIds.length === 0) {
      return NextResponse.json(
        { error: 'No players on teams' },
        { status: 400 }
      )
    }

    const rsvpSnap = await adminDb
      .collection('rsvps')
      .where('matchId', '==', matchId)
      .where('status', '==', 'confirmed')
      .get()

    const rsvpByUserId = new Map<
      string,
      { id: string; position: string | null }
    >()
    for (const d of rsvpSnap.docs) {
      const data = d.data()
      const userId = data.userId as string
      if (!userId) continue
      rsvpByUserId.set(userId, {
        id: d.id,
        position: (data.position as string | null) ?? null,
      })
    }

    const users = await getUsersByIdsAdmin(adminDb, allPlayerIds)
    const userById = new Map(users.map(u => [u.uid, u]))

    const planned: Array<{
      userId: string
      rsvpId: string
      /** Effective position used for closest-slot matching (RSVP or profile). */
      fromPosition: string
      toPosition: string
      teamNumber: number
      /** Stored RSVP.position before apply (may be null on legacy docs). */
      storedPosition: string | null
    }> = []

    for (const team of teams) {
      const players = team.playerIds
        .map(userId => {
          const rsvp = rsvpByUserId.get(userId)
          if (!rsvp) return null
          const profilePos = userById.get(userId)?.position ?? null
          return {
            userId,
            position: rsvp.position ?? profilePos ?? null,
          }
        })
        .filter((p): p is { userId: string; position: string | null } => !!p)

      const mapped = assignPlayersToFormation(players, formation.slots)
      for (const a of mapped) {
        const rsvp = rsvpByUserId.get(a.userId)
        if (!rsvp) continue
        // Persist when the stored RSVP value differs (including null → assigned),
        // not when the profile fallback already matched the target role.
        if (rsvp.position === a.toPosition) continue
        planned.push({
          userId: a.userId,
          rsvpId: rsvp.id,
          fromPosition: a.fromPosition,
          toPosition: a.toPosition,
          teamNumber: team.teamNumber,
          storedPosition: rsvp.position,
        })
      }
    }

    const now = Timestamp.now()
    const matchRef = adminDb.collection('matches').doc(matchId)
    const stateRef = matchRef.collection('_state').doc('rsvp')

    const applied = await adminDb.runTransaction(async tx => {
      const stateSnap = await tx.get(stateRef)
      let gkCount = stateSnap.exists
        ? ((stateSnap.data()?.gkCount as number) ?? 0)
        : 0

      const committed: typeof planned = []

      // All reads before writes (Firestore transaction rule).
      const rsvpSnaps = await Promise.all(
        planned.map(a => tx.get(adminDb.collection('rsvps').doc(a.rsvpId)))
      )

      for (let i = 0; i < planned.length; i++) {
        const a = planned[i]!
        const snap = rsvpSnaps[i]!
        if (!snap.exists) continue
        const data = snap.data() ?? {}
        if (data.status !== 'confirmed') continue
        if ((data.matchId as string | undefined) !== matchId) continue

        const currentPos = (data.position as string | null | undefined) ?? null
        if (currentPos === a.toPosition) continue

        const oldIsGk = isGoalkeeper(currentPos)
        const newIsGk = isGoalkeeper(a.toPosition)
        if (oldIsGk && !newIsGk) gkCount -= 1
        else if (!oldIsGk && newIsGk) gkCount += 1

        tx.update(snap.ref, {
          position: a.toPosition,
          updatedAt: now,
        })
        committed.push({
          ...a,
          fromPosition: currentPos ?? a.fromPosition,
          storedPosition: currentPos,
        })
      }

      if (stateSnap.exists) {
        tx.set(
          stateRef,
          { gkCount: Math.max(0, gkCount), updatedAt: now },
          { merge: true }
        )
      }

      tx.set(
        matchRef,
        {
          selectedFormation: formationId,
          updatedAt: now,
        },
        { merge: true }
      )

      return committed
    })

    // Clear GK replacement pins that no longer apply after bulk reshuffle.
    if (
      applied.some(
        a => isGoalkeeper(a.fromPosition) || isGoalkeeper(a.toPosition)
      )
    ) {
      await matchRef.set(
        { gkReplacements: FieldValue.delete(), updatedAt: now },
        { merge: true }
      )
    }

    auditLog({
      action: 'team.formation_applied',
      actorUid: uid,
      matchId,
      entityType: 'team',
      source: 'api',
      metadata: {
        formationId,
        teamsUpdated: teams.length,
        positionsChanged: applied.length,
      },
    })

    return NextResponse.json({
      success: true,
      formationId,
      teamsUpdated: teams.length,
      positionsChanged: applied.length,
      assignments: applied.map(a => ({
        userId: a.userId,
        fromPosition: a.fromPosition,
        toPosition: a.toPosition,
        teamNumber: a.teamNumber,
      })),
    })
  } catch (error: unknown) {
    console.error('Error applying formation:', error)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to apply formation') },
      { status: 500 }
    )
  }
}
