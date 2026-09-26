import { NextRequest, NextResponse } from 'next/server'
import { resolveClubIdForWrite, verifyClubAdmin } from '@/lib/api/auth'
import { createMatchDoc } from '@/lib/matches/createMatch'
import { auditLog } from '@/lib/services/auditService'
import type { MatchLocation } from '@/types/match'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, time, location, clubId: clubIdRaw } = body

    const provisionalClubId =
      typeof clubIdRaw === 'string' ? clubIdRaw.trim() : ''
    const provisional = await verifyClubAdmin(
      request,
      provisionalClubId || null
    )
    if (provisional.error || !provisional.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolved = await resolveClubIdForWrite(
      provisional.uid,
      provisionalClubId || null
    )
    if (!resolved.clubId) {
      return NextResponse.json(
        { error: resolved.error || 'clubId is required' },
        { status: 400 }
      )
    }

    const { uid, isClubAdmin, error: authError } = await verifyClubAdmin(
      request,
      resolved.clubId
    )
    if (authError || !uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isClubAdmin) {
      return NextResponse.json(
        { error: 'Club admin privileges required' },
        { status: 403 }
      )
    }

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
      clubId: resolved.clubId,
    })

    auditLog({
      action: 'match.created',
      actorUid: uid,
      matchId,
      entityType: 'match',
      entityId: matchId,
      source: 'api',
      metadata: {
        date,
        time,
        location: locationValue,
        clubId: resolved.clubId,
      },
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
