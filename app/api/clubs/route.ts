import { NextRequest, NextResponse } from 'next/server'
import { verifySuperUser } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import { evaluateFeatureFlag } from '@/lib/flags/evaluateFeatureFlag'
import { createClub } from '@/lib/services/clubService'
import { auditLog } from '@/lib/services/auditService'

export async function POST(request: NextRequest) {
  try {
    const { uid, email, isSuperUser, error } = await verifySuperUser(request)
    if (error || !uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isSuperUser) {
      return NextResponse.json(
        { error: 'Super user privileges required' },
        { status: 403 }
      )
    }

    const clubCreationEnabled = await evaluateFeatureFlag('club-creation', {
      key: uid,
      email,
    })
    if (!clubCreationEnabled) {
      return NextResponse.json(
        { error: 'Club creation is unavailable' },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => null)
    const name = typeof body?.name === 'string' ? body.name : ''
    const allowPlayerInvites =
      typeof body?.settings?.allowPlayerInvites === 'boolean'
        ? body.settings.allowPlayerInvites
        : undefined

    if (!name.trim()) {
      return NextResponse.json(
        { error: 'Club name is required' },
        { status: 400 }
      )
    }

    const club = await createClub({
      name,
      createdBy: uid,
      settings:
        allowPlayerInvites === undefined
          ? undefined
          : { allowPlayerInvites },
    })

    auditLog({
      action: 'club.created',
      actorUid: uid,
      entityType: 'club',
      entityId: club.id,
      source: 'api',
      metadata: { name: club.name, slug: club.slug },
    })

    return NextResponse.json({ success: true, club }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create club'
    const status = message.includes('already exists')
      ? 409
      : message.includes('must include')
        ? 400
        : 500
    console.error('Error creating club:', err)
    return NextResponse.json(
      { error: sanitizeErrorForClient(err, 'Failed to create club') },
      { status }
    )
  }
}
