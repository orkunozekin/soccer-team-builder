import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth'
import { createMatch } from '@/lib/services/matchService'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const { uid, error: authError } = await verifyAuth(request)
    if (authError || !uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Note: Admin verification should be done here

    const { date, time } = await request.json()

    if (!date || !time) {
      return NextResponse.json(
        { error: 'Date and time are required' },
        { status: 400 }
      )
    }

    // Validate date
    const matchDate = new Date(date)
    if (isNaN(matchDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(time)) {
      return NextResponse.json({ error: 'Invalid time format' }, { status: 400 })
    }

    // Note: Admin verification should be done here with Firebase Admin SDK
    // For now, relying on Firestore security rules

    const matchId = await createMatch(matchDate, time, false)

    return NextResponse.json({ success: true, matchId })
  } catch (error: any) {
    console.error('Error creating match:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create match' },
      { status: 500 }
    )
  }
}
