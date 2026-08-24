import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, verifyAuth } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import { recordAuditLog } from '@/lib/services/auditService'
import {
  CLIENT_AUDIT_ACTIONS,
  type AuditAction,
  type AuditLogInput,
} from '@/types/auditLog'

function isClientAuditAction(action: string): action is AuditAction {
  return (CLIENT_AUDIT_ACTIONS as readonly string[]).includes(action)
}

/**
 * POST /api/audit
 * Record client-side user events (auth, profile updates, admin toggles).
 * Body: { action, targetUid?, matchId?, entityType?, entityId?, metadata? }
 */
export async function POST(request: NextRequest) {
  try {
    const { uid, error: authError } = await verifyAuth(request)
    if (authError || !uid || uid === 'fallback') {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => null)
    const action =
      typeof body?.action === 'string' ? body.action.trim() : ''

    if (!action || !isClientAuditAction(action)) {
      return NextResponse.json({ error: 'Invalid audit action' }, { status: 400 })
    }

    const targetUid =
      typeof body?.targetUid === 'string' ? body.targetUid.trim() : undefined
    const matchId =
      typeof body?.matchId === 'string' ? body.matchId.trim() : undefined
    const entityId =
      typeof body?.entityId === 'string' ? body.entityId.trim() : undefined
    const entityType = body?.entityType
    const metadata =
      body?.metadata != null &&
      typeof body.metadata === 'object' &&
      !Array.isArray(body.metadata)
        ? (body.metadata as Record<string, unknown>)
        : undefined

    if (action === 'user.role_changed' || action === 'match.rsvp_poll_toggled') {
      const { isAdmin } = await verifyAdmin(request)
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Admin privileges required' },
          { status: 403 }
        )
      }
    }

    const input: AuditLogInput = {
      action,
      actorUid: uid,
      source: 'client',
    }

    if (targetUid) input.targetUid = targetUid
    if (matchId) input.matchId = matchId
    if (entityId) input.entityId = entityId
    if (
      entityType === 'user' ||
      entityType === 'match' ||
      entityType === 'rsvp' ||
      entityType === 'team' ||
      entityType === 'location'
    ) {
      input.entityType = entityType
    }
    if (metadata) input.metadata = metadata

    const logId = await recordAuditLog(input)
    return NextResponse.json({ success: true, logId })
  } catch (error: unknown) {
    console.error('audit route error:', error)
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to record audit event') },
      { status: 500 }
    )
  }
}
