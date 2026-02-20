import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function timestampToDate(t: Timestamp | Date | null | undefined): Date | null {
  if (!t) return null
  if (t instanceof Date) return t
  return (t as Timestamp).toDate()
}

/**
 * GET (or POST) /api/cron/rsvp-schedule
 * Applies scheduled RSVP open/close for all matches that have rsvpOpenAt and rsvpCloseAt set.
 * Secured by CRON_SECRET: request must include Authorization: Bearer <CRON_SECRET>.
 * Call this from Vercel Cron (every 15 min) or from BullMQ / external cron.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminDb = getAdminDb()
  if (!adminDb) {
    return NextResponse.json(
      { error: 'Firebase Admin not configured' },
      { status: 500 }
    )
  }

  try {
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

    return NextResponse.json({
      ok: true,
      checked: matchesSnap.size,
      opened,
      closed,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('cron/rsvp-schedule error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
