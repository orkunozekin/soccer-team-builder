import { Timestamp, FieldValue } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'
import { expandTeamsForMatch } from '@/lib/teams/expandTeamsForMatch'
import { removeUserFromMatchTeams } from '@/lib/teams/removeUserFromMatchTeams'
import { swapGkWithLowerPriority, performGkSwap } from '@/lib/teams/swapGkWithLowerTeam'
import { isGoalkeeper } from '@/lib/utils/teamGenerator'

/**
 * POST: Confirm RSVP for the authenticated user.
 * Creates the RSVP document, then expands teams if needed (e.g. 3rd team when 23+ RSVPs).
 */
export async function POST(request: NextRequest) {
  try {
    const { uid, error: authError } = await verifyAuth(request)
    if (authError || !uid) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const matchId = body?.matchId
    if (!matchId || typeof matchId !== 'string') {
      return NextResponse.json({ error: 'Match ID required' }, { status: 400 })
    }

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const matchSnap = await adminDb.collection('matches').doc(matchId).get()
    if (!matchSnap.exists) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }
    const rsvpOpen = matchSnap.data()?.rsvpOpen === true
    if (!rsvpOpen) {
      return NextResponse.json(
        { error: 'RSVP is closed for this match' },
        { status: 403 }
      )
    }

    const userSnap = await adminDb.collection('users').doc(uid).get()
    const userData = userSnap.exists ? userSnap.data() : null
    const displayName = userData?.displayName
    const hasName = typeof displayName === 'string' && displayName.trim().length > 0
    if (!hasName) {
      return NextResponse.json(
        { error: 'Set your display name to RSVP' },
        { status: 400 }
      )
    }

    // Use provided position or fall back to profile position (per-RSVP position is stored and not changed by later profile updates)
    const positionFromBody = body?.position != null
      ? (typeof body.position === 'string' ? body.position.trim() || null : null)
      : null
    const position = positionFromBody ?? (userData?.position as string | null) ?? null

    const existing = await adminDb
      .collection('rsvps')
      .where('matchId', '==', matchId)
      .where('userId', '==', uid)
      .where('status', '==', 'confirmed')
      .limit(1)
      .get()

    let rsvpId: string
    if (!existing.empty) {
      const existingDoc = existing.docs[0]
      rsvpId = existingDoc.id
      const existingPosition = (existingDoc.data()?.position as string | null) ?? null
      const { regenerated } = await expandTeamsForMatch(adminDb, matchId)
      return NextResponse.json({ rsvpId, regenerated, position: existingPosition })
    }

    // At most 2 goalkeepers in the match (main two teams). Reject if user is GK and 2 GKs already confirmed.
    // Count using effective position: RSVP position if set, otherwise the user's profile position.
    if (isGoalkeeper(position)) {
      const confirmedSnap = await adminDb
        .collection('rsvps')
        .where('matchId', '==', matchId)
        .where('status', '==', 'confirmed')
        .get()
      const userIds = confirmedSnap.docs.map((d) => d.data()?.userId as string).filter(Boolean)
      const userPositions = new Map<string, string | null>()
      if (userIds.length > 0) {
        const uniq = Array.from(new Set(userIds))
        await Promise.all(
          uniq.map(async (id) => {
            const u = await adminDb.collection('users').doc(id).get()
            userPositions.set(id, (u.data()?.position as string | null) ?? null)
          })
        )
      }
      const gkCount = confirmedSnap.docs.filter((d) => {
        const data = d.data()
        const rsvpPosition = (data?.position as string | null) ?? null
        const effectivePosition = rsvpPosition ?? userPositions.get(data?.userId as string) ?? null
        return isGoalkeeper(effectivePosition)
      }).length
      if (gkCount >= 2) {
        return NextResponse.json(
          {
            error:
              'There are already 2 goalkeepers for this match. Please choose a different position to RSVP.',
            code: 'TOO_MANY_GKS',
          },
          { status: 400 }
        )
      }
    }

    rsvpId = `rsvp_${matchId}_${uid}_${Date.now()}`
    const now = Timestamp.now()

    await adminDb.collection('rsvps').doc(rsvpId).set({
      matchId,
      userId: uid,
      status: 'confirmed',
      position: position ?? null,
      rsvpAt: now,
      updatedAt: now,
    })

    const { regenerated } = await expandTeamsForMatch(adminDb, matchId)

    return NextResponse.json({
      rsvpId,
      regenerated,
      position: position ?? null,
    })
  } catch (error: any) {
    console.error('Error creating RSVP:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create RSVP' },
      { status: 500 }
    )
  }
}

/**
 * PATCH: Cancel an RSVP (body: { rsvpId }).
 * Marks RSVP as cancelled and removes the user from their team; removes the team if they were the last player.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { uid, error: authError } = await verifyAuth(request)
    if (authError || !uid) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const rsvpId = body?.rsvpId
    const positionFromBody = body?.position
    if (!rsvpId || typeof rsvpId !== 'string') {
      return NextResponse.json({ error: 'rsvpId required' }, { status: 400 })
    }

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const rsvpRef = adminDb.collection('rsvps').doc(rsvpId)
    const rsvpSnap = await rsvpRef.get()
    if (!rsvpSnap.exists) {
      return NextResponse.json({ error: 'RSVP not found' }, { status: 404 })
    }

    const data = rsvpSnap.data()!
    if (data.userId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (data.status === 'cancelled') {
      return NextResponse.json({ cancelled: true, teamsUpdated: false })
    }

    const matchId = data.matchId as string
    const userId = data.userId as string

    // Update position flow (PATCH with position field)
    if (positionFromBody !== undefined) {
      const newPosition = typeof positionFromBody === 'string' ? positionFromBody.trim() || null : null
      const userSnap = await adminDb.collection('users').doc(userId).get()
      const userData = userSnap.exists ? userSnap.data() : null
      const oldPosition = (data.position as string | null) ?? (userData?.position as string | null) ?? null
      const oldIsGk = isGoalkeeper(oldPosition)
      const newIsGk = isGoalkeeper(newPosition)

      let swapOccurred = false
      let otherPlayerDisplayName: string | undefined
      let swapWithReplacedPlayer = false

      if (oldIsGk && !newIsGk) {
        const teamsCol = adminDb.collection(`matches/${matchId}/teams`)
        const teamsSnap = await teamsCol.get()
        let currentUserTeamNumber = 0
        const teamNumbersByUserId = new Map<string, number>()
        for (const d of teamsSnap.docs) {
          const playerIds = (d.data().playerIds as string[]) ?? []
          const teamNumber = (d.data().teamNumber as number) ?? 0
          for (const pid of playerIds) teamNumbersByUserId.set(pid, teamNumber)
          if (playerIds.includes(userId)) currentUserTeamNumber = teamNumber
        }

        // If this GK had replaced a non-GK (e.g. via rebalance), swap back with that person first
        const matchSnap = await adminDb.collection('matches').doc(matchId).get()
        const gkReplacements = (matchSnap.exists ? matchSnap.data()?.gkReplacements : null) as Record<string, string> | undefined
        const replacedUserId = gkReplacements?.[userId]
        const replacedUserTeamNumber = replacedUserId != null ? teamNumbersByUserId.get(replacedUserId) : undefined
        const replacedUserOnLowerTeam =
          replacedUserId != null &&
          replacedUserTeamNumber != null &&
          replacedUserTeamNumber > currentUserTeamNumber

        if (replacedUserOnLowerTeam) {
          const otherUserSnap = await adminDb.collection('users').doc(replacedUserId).get()
          otherPlayerDisplayName = otherUserSnap.exists ? (otherUserSnap.data()?.displayName as string) || undefined : undefined
          swapWithReplacedPlayer = true
          await performGkSwap(adminDb, matchId, userId, replacedUserId)
          swapOccurred = true
          await adminDb.collection('matches').doc(matchId).update({
            [`gkReplacements.${userId}`]: FieldValue.delete(),
          })
        } else {
          const rsvpsSnap = await adminDb
            .collection('rsvps')
            .where('matchId', '==', matchId)
            .where('status', '==', 'confirmed')
            .get()
          const rsvpPositionsByUserId = new Map<string, string | null>()
          rsvpsSnap.docs.forEach((d) => {
            const ddata = d.data()
            const u = ddata.userId as string
            rsvpPositionsByUserId.set(u, (ddata.position as string | null) ?? null)
          })
          const usersSnap = await adminDb.collection('users').get()
          const userPositionsByUserId = new Map<string, string | null>()
          usersSnap.docs.forEach((d) => {
            const u = d.id === d.data()?.uid ? d.id : (d.data()?.uid as string)
            userPositionsByUserId.set(u, (d.data()?.position as string | null) ?? null)
          })

          const swapResult = await swapGkWithLowerPriority(
            adminDb,
            matchId,
            userId,
            currentUserTeamNumber,
            rsvpPositionsByUserId,
            userPositionsByUserId
          )
          if (swapResult.swapOccurred && swapResult.otherGkUserId) {
            const otherUserSnap = await adminDb.collection('users').doc(swapResult.otherGkUserId).get()
            otherPlayerDisplayName = otherUserSnap.exists ? (otherUserSnap.data()?.displayName as string) || undefined : undefined
            await performGkSwap(adminDb, matchId, userId, swapResult.otherGkUserId)
            swapOccurred = true
          }
        }
      }

      await rsvpRef.update({
        position: newPosition,
        updatedAt: Timestamp.now(),
      })

      return NextResponse.json({
        updated: true,
        swapOccurred,
        otherPlayerDisplayName: swapOccurred ? otherPlayerDisplayName : undefined,
        swapWithReplacedPlayer: swapOccurred ? swapWithReplacedPlayer : undefined,
        teamsUpdated: swapOccurred,
      })
    }

    // Cancel RSVP flow (no position in body)
    await rsvpRef.update({
      status: 'cancelled',
      updatedAt: Timestamp.now(),
    })

    const { removed } = await removeUserFromMatchTeams(adminDb, matchId, userId)

    return NextResponse.json({
      cancelled: true,
      teamsUpdated: removed,
    })
  } catch (error: any) {
    console.error('Error updating/cancelling RSVP:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to cancel RSVP' },
      { status: 500 }
    )
  }
}
