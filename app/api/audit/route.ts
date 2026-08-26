import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, verifyAdmin } from '@/lib/api/auth'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import { enrichAuditLogsWithDisplayNames } from '@/lib/audit/enrichAuditLogNames'
import { countAuditLogs, queryAuditLogs } from '@/lib/audit/queryAuditLogs'
import { getAdminDb } from '@/lib/firebase/admin'
import { recordAuditLog } from '@/lib/services/auditService'
import {
  ALL_AUDIT_ACTIONS,
  ALL_AUDIT_SOURCES,
  CLIENT_AUDIT_ACTIONS,
  type AuditAction,
  type AuditLogInput,
  type AuditSource,
} from '@/types/auditLog'

function isClientAuditAction(action: string): action is AuditAction {
  return (CLIENT_AUDIT_ACTIONS as readonly string[]).includes(action)
}

function parseAuditAction(value: string | null): AuditAction | undefined {
  if (!value) return undefined
  return (ALL_AUDIT_ACTIONS as readonly string[]).includes(value)
    ? (value as AuditAction)
    : undefined
}

function parseAuditSource(value: string | null): AuditSource | undefined {
  if (!value) return undefined
  return (ALL_AUDIT_SOURCES as readonly string[]).includes(value as AuditSource)
    ? (value as AuditSource)
    : undefined
}

/**
 * GET /api/audit
 * List audit logs (admin only).
 * Query: limit, cursor, action, source, actorUid, targetUid, matchId
 */
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

    const { searchParams } = new URL(request.url)
    const limitRaw = Number(searchParams.get('limit') ?? '25')
    const limit = Number.isFinite(limitRaw)
      ? Math.min(50, Math.max(1, limitRaw))
      : 25
    const cursor = searchParams.get('cursor')
    const includeCount = searchParams.get('includeCount') === 'true'

    const filters = {
      action: parseAuditAction(searchParams.get('action')),
      source: parseAuditSource(searchParams.get('source')),
      actorUid: searchParams.get('actorUid')?.trim() || undefined,
      targetUid: searchParams.get('targetUid')?.trim() || undefined,
      matchId: searchParams.get('matchId')?.trim() || undefined,
    }

    const [{ logs, nextCursor }, totalCount] = await Promise.all([
      queryAuditLogs(adminDb, { limit, cursor, filters }),
      includeCount ? countAuditLogs(adminDb, filters) : Promise.resolve(undefined),
    ])

    const enrichedLogs = await enrichAuditLogsWithDisplayNames(adminDb, logs)

    return NextResponse.json({
      success: true,
      logs: enrichedLogs,
      nextCursor,
      ...(totalCount != null ? { totalCount } : {}),
    })
  } catch (error: unknown) {
    console.error('audit GET error:', error)
    return NextResponse.json(
      { error: sanitizeErrorForClient(error, 'Failed to load analytics') },
      { status: 500 }
    )
  }
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
