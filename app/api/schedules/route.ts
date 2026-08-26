import { Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'
import { mapScheduleDoc, materializeSchedule } from '@/lib/schedules/materializeSchedule'
import {
  serializeSlotsForFirestore,
  validateScheduleInput,
} from '@/lib/schedules/validateSchedule'
import { SCHEDULE_TIMEZONE } from '@/types/schedule'

export async function GET(request: NextRequest) {
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

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const snap = await adminDb.collection('schedules').get()
    const schedules = snap.docs
      .map(doc => mapScheduleDoc(doc.id, doc.data() as Record<string, unknown>))
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ schedules })
  } catch (error: unknown) {
    console.error('Error listing schedules:', error)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to list schedules') },
      { status: 500 }
    )
  }
}

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

    const body = await request.json()
    const validated = validateScheduleInput(body)
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const adminDb = getAdminDb()
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const { name, cadence, interval, timezone, slots, active } = validated.value
    if (!name || !cadence || !slots || interval == null) {
      return NextResponse.json({ error: 'Invalid schedule' }, { status: 400 })
    }

    const scheduleId = `sched_${Date.now()}`
    const now = Timestamp.now()
    const isActive = active === true

    await adminDb
      .collection('schedules')
      .doc(scheduleId)
      .set({
        name,
        cadence,
        interval,
        timezone: timezone || SCHEDULE_TIMEZONE,
        slots: serializeSlotsForFirestore(slots),
        active: isActive,
        createdAt: now,
        updatedAt: now,
        createdBy: uid,
      })

    let materialize = null
    if (isActive) {
      materialize = await materializeSchedule(scheduleId)
    }

    const schedule = mapScheduleDoc(scheduleId, {
      name,
      cadence,
      interval,
      timezone: timezone || SCHEDULE_TIMEZONE,
      slots: serializeSlotsForFirestore(slots),
      active: isActive,
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
    })

    return NextResponse.json({ success: true, schedule, materialize })
  } catch (error: unknown) {
    console.error('Error creating schedule:', error)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to create schedule') },
      { status: 500 }
    )
  }
}
