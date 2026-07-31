import { Receiver } from '@upstash/qstash'
import { Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase/admin'
import { getRSVPSchedule } from '@/lib/utils/rsvpScheduler'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function timestampToDate(t: Timestamp | Date | null | undefined): Date | null {
  if (!t) return null
  if (t instanceof Date) return t
  return (t as Timestamp).toDate()
}

/**
 * Canonical URL for this endpoint. QStash signs the destination URL; verification
 * must use the same URL. On Vercel, request.url can differ (proxy/internal), so
 * we use BASE_URL when set (e.g. https://soccerville.club).
 */
function getCronEndpointUrl(request: NextRequest): string {
  const base = (process.env.BASE_URL || process.env.VERCEL_URL)?.replace(
    /\/$/,
    ''
  )
  if (base) {
    const scheme = base.startsWith('http') ? '' : 'https://'
    return `${scheme}${base}/api/cron/rsvp-schedule`
  }
  return request.url
}

/**
 * Authorize the request: QStash signature (when keys set) or CRON_SECRET.
 */
async function authorizeCronRequest(
  request: NextRequest,
  body: string
): Promise<boolean> {
  const signature =
    request.headers.get('Upstash-Signature') ??
    request.headers.get('upstash-signature')
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim() ?? ''
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim() ?? ''

  if (signature && (currentKey || nextKey)) {
    try {
      const receiver = new Receiver({
        currentSigningKey: currentKey,
        nextSigningKey: nextKey,
      })
      const verifyUrl = getCronEndpointUrl(request)
      const isValid = await receiver.verify({
        body,
        signature,
        url: verifyUrl,
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
 * Apply RSVP open/close from schedule (9am CT → match start + 4h).
 * At close time sets rsvpOpen false — never auto-deletes matches.
 * Triggered hourly by Upstash QStash or manually with CRON_SECRET.
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
  const matchesSnap = await adminDb.collection('matches').get()

  let opened = 0
  let closed = 0
  const batch = adminDb.batch()
  let batchOps = 0

  for (const doc of matchesSnap.docs) {
    const data = doc.data()
    const matchDate = timestampToDate(data.date)
    if (!matchDate) continue

    const time = typeof data.time === 'string' ? data.time : null
    const { openAt, closeAt } = getRSVPSchedule(matchDate, time)
    if (!openAt || !closeAt) continue

    const shouldBeOpen = now >= openAt && now <= closeAt
    const currentlyOpen = data.rsvpOpen === true
    const pastClose = now > closeAt

    if (shouldBeOpen && !currentlyOpen) {
      batch.update(doc.ref, {
        rsvpOpen: true,
        updatedAt: Timestamp.now(),
      })
      opened += 1
      batchOps += 1
    } else if (pastClose && currentlyOpen) {
      batch.update(doc.ref, {
        rsvpOpen: false,
        updatedAt: Timestamp.now(),
      })
      closed += 1
      batchOps += 1
    }
  }

  if (batchOps > 0) {
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
 * Used by Upstash QStash hourly schedule.
 */
export async function POST(request: NextRequest) {
  const body = await request.text()
  if (!(await authorizeCronRequest(request, body))) {
    console.warn(
      'cron/rsvp-schedule: unauthorized (signature verification failed or missing CRON_SECRET)'
    )
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
