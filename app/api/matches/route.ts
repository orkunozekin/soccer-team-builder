import { Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'
import { getRSVPSchedule } from '@/lib/utils/rsvpScheduler'

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

    const { date, time } = await request.json()

    if (!date || !time) {
      return NextResponse.json(
        { error: 'Date and time are required' },
        { status: 400 }
      )
    }

    const matchDate = new Date(date)
    if (isNaN(matchDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }

    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(time)) {
      return NextResponse.json({ error: 'Invalid time format' }, { status: 400 })
    }

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const { openAt, closeAt } = getRSVPSchedule(matchDate)
    const matchId = `match_${Date.now()}`
    const now = Timestamp.now()
    await adminDb.collection('matches').doc(matchId).set({
      date: Timestamp.fromDate(matchDate),
      time,
      rsvpOpen: false,
      rsvpOpenAt: openAt ? Timestamp.fromDate(openAt) : null,
      rsvpCloseAt: closeAt ? Timestamp.fromDate(closeAt) : null,
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({ success: true, matchId })
  } catch (error: any) {
    console.error('Error creating match:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create match' },
      { status: 500 }
    )
  }
}
