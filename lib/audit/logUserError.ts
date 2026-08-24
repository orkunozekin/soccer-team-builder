import { NextResponse } from 'next/server'
import { auditLog } from '@/lib/services/auditService'
import type { AuditAction, AuditEntityType } from '@/types/auditLog'

export type UserErrorContext = {
  action: AuditAction
  actorUid: string
  status: number
  message: string
  code?: string
  matchId?: string
  targetUid?: string
  entityType?: AuditEntityType
  entityId?: string
  metadata?: Record<string, unknown>
}

export function logUserError(ctx: UserErrorContext): void {
  auditLog({
    action: ctx.action,
    actorUid: ctx.actorUid,
    targetUid: ctx.targetUid,
    matchId: ctx.matchId,
    entityType: ctx.entityType,
    entityId: ctx.entityId,
    source: 'api',
    metadata: {
      outcome: 'failed',
      status: ctx.status,
      message: ctx.message,
      ...(ctx.code ? { code: ctx.code } : {}),
      ...ctx.metadata,
    },
  })
}

/** Log a user-facing API error and return a JSON response. */
export function userErrorResponse(
  ctx: UserErrorContext,
  body: Record<string, unknown>
): NextResponse {
  logUserError(ctx)
  return NextResponse.json(body, { status: ctx.status })
}
