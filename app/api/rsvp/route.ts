import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import { getAdminDb } from '@/lib/firebase/admin'
import { acquireMatchLock } from '@/lib/locks/matchLock'
import { expandTeamsForMatch } from '@/lib/teams/expandTeamsForMatch'
import { placeGkOnTeamWithoutGk } from '@/lib/teams/placeGkOnTeamWithoutGk'
import { removeUserFromMatchTeams } from '@/lib/teams/removeUserFromMatchTeams'
import { performGkSwap, swapGkWithLowerPriority } from '@/lib/teams/swapGkWithLowerTeam'
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
      const lock = await acquireMatchLock(adminDb, matchId)
      if (!lock) {
        return NextResponse.json(
          { error: 'Team update is busy. Please try again in a moment.', code: 'LOCK_BUSY' },
          { status: 503 }
        )
      }
      try {
        const { regenerated } = await expandTeamsForMatch(adminDb, matchId)
        return NextResponse.json({ rsvpId, regenerated, position: existingPosition })
      } finally {
        await lock.release()
      }
    }

    // Atomic GK cap + RSVP create using a single per-match state doc (minimal read set for less transaction contention).
    // Retry on Firestore transaction abort.
    const stateRef = adminDb.collection('matches').doc(matchId).collection('_state').doc('rsvp')
    const TX_MAX_ATTEMPTS = 7
    const TX_BACKOFF_BASE_MS = 80
    const TX_BACKOFF_JITTER_MS = 120
    let txError: unknown
    rsvpId = `rsvp_${matchId}_${uid}_${Date.now()}`
    for (let attempt = 1; attempt <= TX_MAX_ATTEMPTS; attempt++) {
      rsvpId = `rsvp_${matchId}_${uid}_${Date.now()}`
      const now = Timestamp.now()
      const rsvpRef = adminDb.collection('rsvps').doc(rsvpId)
      const rsvpData = {
        matchId,
        userId: uid,
        status: 'confirmed' as const,
        position: position ?? null,
        rsvpAt: now,
        updatedAt: now,
      }
      try {
        await adminDb.runTransaction(async (tx) => {
          const stateSnap = await tx.get(stateRef)
          const state = stateSnap.data() ?? {}
          const confirmedCount = (state.confirmedCount as number) ?? 0
          const gkCount = (state.gkCount as number) ?? 0
          if (isGoalkeeper(position) && gkCount >= 2) {
            const err = new Error('TOO_MANY_GKS') as Error & { code?: string }
            err.code = 'TOO_MANY_GKS'
            throw err
          }
          const newGkCount = gkCount + (isGoalkeeper(position) ? 1 : 0)
          tx.set(stateRef, {
            confirmedCount: confirmedCount + 1,
            gkCount: newGkCount,
            updatedAt: now,
          })
          tx.set(rsvpRef, rsvpData)
        })
        txError = null
        break
      } catch (e: unknown) {
        const err = e as { code?: string | number; message?: string }
        if (String(err?.code) === 'TOO_MANY_GKS') {
          return NextResponse.json(
            {
              error:
                'There are already 2 goalkeepers for this match. Please choose a different position to RSVP.',
              code: 'TOO_MANY_GKS',
            },
            { status: 400 }
          )
        }
        txError = e
        const msg = String(err?.message ?? e)
        const isAbort = msg.includes('ABORTED') || msg.includes('Transaction') || msg.includes('lock timeout')
        if (!isAbort || attempt === TX_MAX_ATTEMPTS) throw e
        const delay =
          TX_BACKOFF_BASE_MS * attempt +
          Math.floor(Math.random() * (TX_BACKOFF_JITTER_MS + 1))
        await new Promise((r) => setTimeout(r, delay))
      }
    }
    if (txError) throw txError

    const lock = await acquireMatchLock(adminDb, matchId)
    if (!lock) {
      return NextResponse.json(
        { error: 'Team update is busy. Please try again in a moment.', code: 'LOCK_BUSY' },
        { status: 503 }
      )
    }
    let regenerated = false
    try {
      const result = await expandTeamsForMatch(adminDb, matchId)
      regenerated = result.regenerated
    } finally {
      await lock.release()
    }

    return NextResponse.json({
      rsvpId,
      regenerated,
      position: position ?? null,
    })
  } catch (error: any) {
    console.error('Error creating RSVP:', error)
    const msg = error?.message ?? ''
    const isTransactionAbort =
      msg.includes('ABORTED') || msg.includes('Transaction') || msg.includes('lock timeout')
    const userMessage = isTransactionAbort
      ? 'Too many people RSVPing at once. Please try again in a moment.'
      : sanitizeErrorForClient(error, 'Failed to create RSVP')
    return NextResponse.json(
      { error: userMessage, code: isTransactionAbort ? 'RETRY' : undefined },
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

      const stateRef = adminDb.collection('matches').doc(matchId).collection('_state').doc('rsvp')
      const now = Timestamp.now()
      try {
        await adminDb.runTransaction(async (tx) => {
          const stateSnap = await tx.get(stateRef)
          if (stateSnap.exists) {
            const state = stateSnap.data() ?? {}
            let gkCount = (state.gkCount as number) ?? 0
            if (!oldIsGk && newIsGk && gkCount >= 2) {
              const err = new Error('TOO_MANY_GKS') as Error & { code?: string }
              err.code = 'TOO_MANY_GKS'
              throw err
            }
            if (oldIsGk && !newIsGk) gkCount -= 1
            else if (!oldIsGk && newIsGk) gkCount += 1
            tx.set(stateRef, { ...state, gkCount, updatedAt: now }, { merge: true })
          }
          tx.update(rsvpRef, { position: newPosition, updatedAt: now })
        })
      } catch (e: unknown) {
        const err = e as { code?: string }
        if (err?.code === 'TOO_MANY_GKS') {
          return NextResponse.json(
            {
              error:
                'There are already 2 goalkeepers for this match. Please choose a different position to RSVP.',
              code: 'TOO_MANY_GKS',
            },
            { status: 400 }
          )
        }
        throw e
      }

      if (!oldIsGk && newIsGk && !swapOccurred) {
        const rsvpsSnap = await adminDb
          .collection('rsvps')
          .where('matchId', '==', matchId)
          .where('status', '==', 'confirmed')
          .get()
        const rsvpPositionsByUserId = new Map<string, string | null>()
        rsvpsSnap.docs.forEach((d) => {
          const ddata = d.data()
          rsvpPositionsByUserId.set(ddata.userId as string, (ddata.position as string | null) ?? null)
        })
        const usersSnap = await adminDb.collection('users').get()
        const userPositionsByUserId = new Map<string, string | null>()
        usersSnap.docs.forEach((d) => {
          const u = d.id === d.data()?.uid ? d.id : (d.data()?.uid as string)
          userPositionsByUserId.set(u, (d.data()?.position as string | null) ?? null)
        })
        const placeResult = await placeGkOnTeamWithoutGk(
          adminDb,
          matchId,
          userId,
          rsvpPositionsByUserId,
          userPositionsByUserId
        )
        if (placeResult.placed && placeResult.replacedUserId) {
          swapOccurred = true
          const replacedSnap = await adminDb.collection('users').doc(placeResult.replacedUserId).get()
          otherPlayerDisplayName = replacedSnap.exists ? (replacedSnap.data()?.displayName as string) || undefined : undefined
        }
      }

      return NextResponse.json({
        updated: true,
        swapOccurred,
        otherPlayerDisplayName: swapOccurred ? otherPlayerDisplayName : undefined,
        swapWithReplacedPlayer: swapOccurred ? swapWithReplacedPlayer : undefined,
        teamsUpdated: swapOccurred,
      })
    }

    // Cancel RSVP flow (no position in body). Keep _state/rsvp in sync when present (new matches).
    const stateRefForCancel = adminDb.collection('matches').doc(matchId).collection('_state').doc('rsvp')
    const wasGk = isGoalkeeper((data.position as string | null) ?? null)
    const now = Timestamp.now()
    await adminDb.runTransaction(async (tx) => {
      const stateSnap = await tx.get(stateRefForCancel)
      tx.update(rsvpRef, { status: 'cancelled', updatedAt: now })
      if (stateSnap.exists) {
        const state = stateSnap.data() ?? {}
        const confirmedCount = Math.max(0, ((state.confirmedCount as number) ?? 0) - 1)
        const gkCount = Math.max(0, ((state.gkCount as number) ?? 0) - (wasGk ? 1 : 0))
        tx.set(stateRefForCancel, { confirmedCount, gkCount, updatedAt: now }, { merge: true })
      }
    })

    const { removed } = await removeUserFromMatchTeams(adminDb, matchId, userId)

    // When the last person cancels, ensure all teams are removed (safeguard in case user wasn't in a team doc)
    const confirmedAfter = await adminDb
      .collection('rsvps')
      .where('matchId', '==', matchId)
      .where('status', '==', 'confirmed')
      .limit(1)
      .get()
    if (confirmedAfter.empty) {
      const teamsSnap = await adminDb.collection(`matches/${matchId}/teams`).get()
      if (!teamsSnap.empty) {
        const batch = adminDb.batch()
        teamsSnap.docs.forEach((d) => batch.delete(d.ref))
        await batch.commit()
      }
    }

    return NextResponse.json({
      cancelled: true,
      teamsUpdated: removed,
    })
  } catch (error: any) {
    console.error('Error updating/cancelling RSVP:', error)
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to cancel RSVP') },
      { status: 500 }
    )
  }
}
