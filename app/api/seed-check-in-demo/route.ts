import { Timestamp } from 'firebase-admin/firestore'
import { formatInTimeZone } from 'date-fns-tz'
import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'
import { expandTeamsForMatch } from '@/lib/teams/expandTeamsForMatch'
import { TEST_USERS } from '@/lib/testData/testUsers'
import { normalizeJerseyNumber } from '@/lib/utils/jerseyNumber'
import { serializeMatchLocation } from '@/lib/utils/location'
import { getRSVPSchedule } from '@/lib/utils/rsvpScheduler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CT_TIMEZONE = 'America/Chicago'

/** GET: health check for this route (no auth). */
export async function GET() {
  return NextResponse.json({ ok: true, route: 'seed-check-in-demo' })
}

async function requireSeedAuth(
  request: Request
): Promise<
  | { ok: true }
  | { ok: false; status: number; body: object }
> {
  const seedSecret = request.headers.get('x-seed-secret')
  const useSecret =
    process.env.SEED_SECRET && seedSecret === process.env.SEED_SECRET
  if (useSecret) return { ok: true }
  const { isAdmin, error } = await verifyAdmin(request)
  if (error || !isAdmin) {
    return {
      ok: false,
      status: 403,
      body: { error: 'Admin required or valid X-Seed-Secret' },
    }
  }
  return { ok: true }
}

/**
 * Build a kickoff in America/Chicago that puts "now" inside the check-in window
 * (kickoff - 40m → kickoff + 2h). Default: kickoff ~10 minutes from now.
 */
function kickoffInCheckInWindow(offsetMinutes = 10): {
  matchDate: Date
  time: string
  kickoff: Date
} {
  const kickoff = new Date(Date.now() + offsetMinutes * 60 * 1000)
  const dateStr = formatInTimeZone(kickoff, CT_TIMEZONE, 'yyyy-MM-dd')
  const time = formatInTimeZone(kickoff, CT_TIMEZONE, 'HH:mm')
  const offset = formatInTimeZone(kickoff, CT_TIMEZONE, 'xxx')
  // Store date as noon CT on that calendar day; `time` holds kickoff HH:mm.
  const matchDate = new Date(`${dateStr}T12:00:00${offset}`)
  return { matchDate, time, kickoff }
}

/**
 * POST /api/seed-check-in-demo
 *
 * Creates (or updates) a match whose check-in window is open now, seeds confirmed
 * RSVPs for all test users, and marks a portion Present so you can eyeball the
 * player-facing check-in status list.
 *
 * Body (all optional):
 *   matchId?: string — update this match instead of creating one
 *   kickoffOffsetMinutes?: number — minutes from now until kickoff (default 10)
 *   presentCount?: number — how many RSVPs to mark Present (default ~half)
 *   regenerateTeams?: boolean — default true
 */
export async function POST(request: Request) {
  try {
    const auth = await requireSeedAuth(request)
    if (!auth.ok) {
      return NextResponse.json(auth.body, { status: auth.status })
    }

    let body: {
      matchId?: string
      kickoffOffsetMinutes?: number
      presentCount?: number
      regenerateTeams?: boolean
    } = {}
    try {
      const text = await request.text()
      if (text.trim()) body = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not configured' },
        { status: 500 }
      )
    }

    const offsetMinutes =
      typeof body.kickoffOffsetMinutes === 'number'
        ? body.kickoffOffsetMinutes
        : 10
    const { matchDate, time, kickoff } = kickoffInCheckInWindow(offsetMinutes)
    const { openAt, closeAt } = getRSVPSchedule(matchDate, time)
    const now = Timestamp.now()
    const regenerateTeamsAfter = body.regenerateTeams !== false

    let matchId = body.matchId
    let createdMatch = false

    if (matchId) {
      const matchRef = adminDb.collection('matches').doc(matchId)
      const snap = await matchRef.get()
      if (!snap.exists) {
        return NextResponse.json({ error: 'Match not found' }, { status: 404 })
      }
      await matchRef.update({
        date: Timestamp.fromDate(matchDate),
        time,
        rsvpOpen: true,
        rsvpOpenAt: openAt ? Timestamp.fromDate(openAt) : null,
        rsvpCloseAt: closeAt ? Timestamp.fromDate(closeAt) : null,
        deletedAt: null,
        updatedAt: now,
      })
    } else {
      matchId = `match_checkin_demo_${Date.now()}`
      createdMatch = true
      await adminDb
        .collection('matches')
        .doc(matchId)
        .set({
          date: Timestamp.fromDate(matchDate),
          time,
          location: serializeMatchLocation({
            name: 'Check-in Demo Field',
            address: '123 Demo Field Rd, Austin, TX',
            lat: 30.2672,
            lng: -97.7431,
          }),
          rsvpOpen: true,
          rsvpOpenAt: openAt ? Timestamp.fromDate(openAt) : null,
          rsvpCloseAt: closeAt ? Timestamp.fromDate(closeAt) : null,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        })
    }

    const usersSnap = await adminDb
      .collection('users')
      .where('isTestUser', '==', true)
      .get()
    const testUsers = usersSnap.docs.map(d => ({
      userId: d.id,
      data: d.data(),
    }))

    if (testUsers.length === 0) {
      return NextResponse.json(
        {
          error:
            'No test users found. Run POST /api/seed-test-users first, then retry.',
          matchId,
          createdMatch,
        },
        { status: 400 }
      )
    }

    // Stable order by display name so Present/Pending split is predictable
    testUsers.sort((a, b) => {
      const an = String(a.data.displayName || a.userId)
      const bn = String(b.data.displayName || b.userId)
      return an.localeCompare(bn)
    })

    const presentCount =
      typeof body.presentCount === 'number'
        ? Math.max(0, Math.min(body.presentCount, testUsers.length))
        : Math.floor(testUsers.length / 2)

    const rsvpResults: {
      userId: string
      displayName: string
      label: 'Present' | 'Pending'
      status: 'created' | 'updated'
    }[] = []

    for (let i = 0; i < testUsers.length; i++) {
      const { userId, data } = testUsers[i]
      const displayName = String(data.displayName || userId)
      const email = String(data.email || '')
      const positionFromSeed =
        TEST_USERS.find(u => u.email.toLowerCase() === email.toLowerCase())
          ?.position ?? null
      const position =
        positionFromSeed ?? (data.position as string | null) ?? null
      const markPresent = i < presentCount

      const existing = await adminDb
        .collection('rsvps')
        .where('matchId', '==', matchId)
        .where('userId', '==', userId)
        .where('status', '==', 'confirmed')
        .limit(1)
        .get()

      const attendanceFields = markPresent
        ? {
            attended: true,
            checkedInAt: now,
            checkInMethod: 'geo' as const,
          }
        : {
            attended: null,
            checkedInAt: null,
            checkInMethod: null,
          }

      if (!existing.empty) {
        const doc = existing.docs[0]
        await doc.ref.update({
          ...attendanceFields,
          position,
          jerseyNumber: normalizeJerseyNumber(data.jerseyNumber),
          updatedAt: now,
        })
        rsvpResults.push({
          userId,
          displayName,
          label: markPresent ? 'Present' : 'Pending',
          status: 'updated',
        })
      } else {
        const rsvpId = `rsvp_${matchId}_${userId}_${now.toMillis()}_${i}`
        await adminDb.collection('rsvps').doc(rsvpId).set({
          matchId,
          userId,
          status: 'confirmed',
          position,
          jerseyNumber: normalizeJerseyNumber(data.jerseyNumber),
          ...attendanceFields,
          rsvpAt: now,
          createdAt: now,
          updatedAt: now,
        })
        rsvpResults.push({
          userId,
          displayName,
          label: markPresent ? 'Present' : 'Pending',
          status: 'created',
        })
      }
    }

    if (regenerateTeamsAfter) {
      await expandTeamsForMatch(adminDb, matchId, { forceRegenerate: true })
    }

    return NextResponse.json({
      success: true,
      matchId,
      createdMatch,
      kickoff: kickoff.toISOString(),
      time,
      checkInWindowOpen: true,
      path: `/matches/${matchId}`,
      regenerateTeams: regenerateTeamsAfter,
      summary: {
        present: rsvpResults.filter(r => r.label === 'Present').length,
        pending: rsvpResults.filter(r => r.label === 'Pending').length,
        created: rsvpResults.filter(r => r.status === 'created').length,
        updated: rsvpResults.filter(r => r.status === 'updated').length,
      },
      rsvps: rsvpResults,
    })
  } catch (err) {
    console.error('seed-check-in-demo error:', err)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(err, 'Failed to seed check-in demo') },
      { status: 500 }
    )
  }
}
