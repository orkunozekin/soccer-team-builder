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

    const assignments: Array<{
      userId: string
      rsvpId: string
      fromPosition: string
      toPosition: string
      teamNumber: number
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
        if (a.fromPosition === a.toPosition) continue
        assignments.push({
          userId: a.userId,
          rsvpId: rsvp.id,
          fromPosition: a.fromPosition,
          toPosition: a.toPosition,
          teamNumber: team.teamNumber,
        })
      }
    }

    const now = Timestamp.now()
    const matchRef = adminDb.collection('matches').doc(matchId)
    const stateRef = matchRef.collection('_state').doc('rsvp')

    await adminDb.runTransaction(async tx => {
      const stateSnap = await tx.get(stateRef)
      let gkCount = stateSnap.exists
        ? ((stateSnap.data()?.gkCount as number) ?? 0)
        : 0

      for (const a of assignments) {
        const oldIsGk = isGoalkeeper(a.fromPosition)
        const newIsGk = isGoalkeeper(a.toPosition)
        if (oldIsGk && !newIsGk) gkCount -= 1
        else if (!oldIsGk && newIsGk) gkCount += 1

        tx.update(adminDb.collection('rsvps').doc(a.rsvpId), {
          position: a.toPosition,
          updatedAt: now,
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
    })

    // Clear GK replacement pins that no longer apply after bulk reshuffle.
    if (assignments.some(a => isGoalkeeper(a.fromPosition) || isGoalkeeper(a.toPosition))) {
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
        positionsChanged: assignments.length,
      },
    })

    return NextResponse.json({
      success: true,
      formationId,
      teamsUpdated: teams.length,
      positionsChanged: assignments.length,
      assignments: assignments.map(a => ({
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
