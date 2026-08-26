import { Timestamp } from 'firebase-admin/firestore'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/api/auth'
import { getAdminDb } from '@/lib/firebase/admin'
import {
  mapScheduleDoc,
  materializeSchedule,
} from '@/lib/schedules/materializeSchedule'
import {
  serializeSlotsForFirestore,
  validateScheduleInput,
} from '@/lib/schedules/validateSchedule'

type RouteContext = { params: { scheduleId: string } }

export async function GET(request: NextRequest, context: RouteContext) {
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

    const { scheduleId } = context.params
    const snap = await adminDb.collection('schedules').doc(scheduleId).get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    return NextResponse.json({
      schedule: mapScheduleDoc(scheduleId, snap.data() as Record<string, unknown>),
    })
  } catch (error: unknown) {
    console.error('Error getting schedule:', error)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to get schedule') },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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

    const { scheduleId } = context.params
    const ref = adminDb.collection('schedules').doc(scheduleId)
    const existing = await ref.get()
    if (!existing.exists) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    const body = await request.json()
    const current = mapScheduleDoc(
      scheduleId,
      existing.data() as Record<string, unknown>
    )

    const validated = validateScheduleInput(
      {
        ...body,
        // When only updating slots, cadence comes from existing
        cadence: body.cadence ?? current.cadence,
      },
      { partial: true }
    )
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const updates: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    }
    const v = validated.value
    if (v.name !== undefined) updates.name = v.name
    if (v.cadence !== undefined) updates.cadence = v.cadence
    if (v.interval !== undefined) updates.interval = v.interval
    if (v.timezone !== undefined) updates.timezone = v.timezone
    if (v.slots !== undefined) {
      updates.slots = serializeSlotsForFirestore(v.slots)
    }
    if (v.active !== undefined) updates.active = v.active

    await ref.update(updates)

    const snap = await ref.get()
    const schedule = mapScheduleDoc(
      scheduleId,
      snap.data() as Record<string, unknown>
    )

    let materialize = null
    if (schedule.active) {
      materialize = await materializeSchedule(scheduleId)
    }

    return NextResponse.json({
      success: true,
      schedule,
      materialize,
    })
  } catch (error: unknown) {
    console.error('Error updating schedule:', error)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to update schedule') },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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

    const { scheduleId } = context.params
    const ref = adminDb.collection('schedules').doc(scheduleId)
    const existing = await ref.get()
    if (!existing.exists) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    await ref.delete()
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error deleting schedule:', error)
    const { sanitizeErrorForClient } = await import('@/lib/api/sanitizeError')
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to delete schedule') },
      { status: 500 }
    )
  }
}
