import { Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import type { AuditLogInput } from '@/types/auditLog'

function generateAuditLogId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Persist an audit log entry to Firestore (auditLogs collection).
 * Returns the log id, or null if logging failed or Admin SDK is unavailable.
 */
export async function recordAuditLog(
  input: AuditLogInput
): Promise<string | null> {
  const adminDb = getAdminDb()
  if (!adminDb) {
    console.warn('[audit] Admin DB not configured, skipping audit log')
    return null
  }

  try {
    const logId = generateAuditLogId()
    const now = Timestamp.now()
    const doc: Record<string, unknown> = {
      action: input.action,
      actorUid: input.actorUid,
      source: input.source,
      createdAt: now,
    }

    if (input.actorRole) doc.actorRole = input.actorRole
    if (input.targetUid) doc.targetUid = input.targetUid
    if (input.matchId) doc.matchId = input.matchId
    if (input.entityType) doc.entityType = input.entityType
    if (input.entityId) doc.entityId = input.entityId
    if (input.metadata && Object.keys(input.metadata).length > 0) {
      doc.metadata = input.metadata
    }

    await adminDb.collection('auditLogs').doc(logId).set(doc)
    return logId
  } catch (error) {
    console.error('[audit] Failed to record audit log:', error)
    return null
  }
}

/**
 * Fire-and-forget audit log for route handlers. Never throws.
 */
export function auditLog(input: AuditLogInput): void {
  void recordAuditLog(input)
}
