import { Receiver } from '@upstash/qstash'
import { Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function timestampToDate(t: Timestamp | Date | null | undefined): Date | null {
  if (!t) return null
  if (t instanceof Date) return t
  return (t as Timestamp).toDate()
}

/**
 * Authorize the request: QStash signature (when keys set) or CRON_SECRET.
 */
async function authorizeCronRequest(
  request: NextRequest,
  body: string
): Promise<boolean> {
  const signature = request.headers.get('Upstash-Signature')
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY

  if (signature && (currentKey || nextKey)) {
    try {
      const receiver = new Receiver({
        currentSigningKey: currentKey ?? '',
        nextSigningKey: nextKey ?? '',
      })
      const isValid = await receiver.verify({
        body,
        signature,
        url: request.url,
      })
      return isValid
    } catch {
      return false
    }
  }

  const expected = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  return Boolean(expected && authHeader === `Bearer ${expected}`)
}

/**
 * Apply RSVP open/close for all matches with rsvpOpenAt/rsvpCloseAt.
 * Triggered by Upstash QStash (9am + 10pm CT) or manually with CRON_SECRET.
 */
async function runRsvpSchedule(): Promise<{
  ok: boolean
  checked: number
  opened: number
  closed: number
}> {
  const adminDb = getAdminDb()
  if (!adminDb) {
    throw new Error('Firebase Admin not configured')
  }

  const now = new Date()
  const matchesSnap = await adminDb
    .collection('matches')
    .where('rsvpOpenAt', '!=', null)
    .get()

  let opened = 0
  let closed = 0
  const batch = adminDb.batch()

  for (const doc of matchesSnap.docs) {
    const data = doc.data()
    const openAt = timestampToDate(data.rsvpOpenAt)
    const closeAt = timestampToDate(data.rsvpCloseAt)
    if (!openAt || !closeAt) continue

    const shouldBeOpen = now >= openAt && now <= closeAt
    const currentlyOpen = data.rsvpOpen === true

    if (shouldBeOpen && !currentlyOpen) {
      batch.update(doc.ref, {
        rsvpOpen: true,
        updatedAt: Timestamp.now(),
      })
      opened += 1
    } else if (!shouldBeOpen && currentlyOpen) {
      batch.update(doc.ref, {
        rsvpOpen: false,
        updatedAt: Timestamp.now(),
      })
      closed += 1
    }
  }

  if (opened > 0 || closed > 0) {
    await batch.commit()
  }

  return {
    ok: true,
    checked: matchesSnap.size,
    opened,
    closed,
  }
}

/**
 * GET /api/cron/rsvp-schedule
 * Auth: Authorization: Bearer <CRON_SECRET> (for manual or legacy triggers).
 */
export async function GET(request: NextRequest) {
  if (!(await authorizeCronRequest(request, ''))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runRsvpSchedule()
    return NextResponse.json(result)
  } catch (err) {
    console.error('cron/rsvp-schedule error:', err)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(err, 'Failed to update RSVP schedule') },
      { status: 500 }
    )
  }
}

/**
 * POST /api/cron/rsvp-schedule
 * Auth: QStash signature (when QSTASH_*_SIGNING_KEY set) or CRON_SECRET.
 * Used by Upstash QStash schedules (9am CT open, 10pm CT close).
 */
export async function POST(request: NextRequest) {
  const body = await request.text()
  if (!(await authorizeCronRequest(request, body))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runRsvpSchedule()
    return NextResponse.json(result)
  } catch (err) {
    console.error('cron/rsvp-schedule error:', err)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(err, 'Failed to update RSVP schedule') },
      { status: 500 }
    )
  }
}
