import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/api/auth'
import { createMatchDoc } from '@/lib/matches/createMatch'
import { auditLog } from '@/lib/services/auditService'
import type { MatchLocation } from '@/types/match'

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

    const { date, time, location } = await request.json()

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
      return NextResponse.json(
        { error: 'Invalid time format' },
        { status: 400 }
      )
    }

    const locationValue = (location as MatchLocation | null) ?? null
    const { matchId } = await createMatchDoc({
      date: matchDate,
      time,
      location: locationValue,
    })

    auditLog({
      action: 'match.created',
      actorUid: uid,
      matchId,
      entityType: 'match',
      entityId: matchId,
      source: 'api',
      metadata: { date, time, location: locationValue },
    })

    return NextResponse.json({ success: true, matchId })
  } catch (error: unknown) {
    console.error('Error creating match:', error)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to create match') },
      { status: 500 }
    )
  }
}
