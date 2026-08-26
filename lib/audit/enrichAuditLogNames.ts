import type { Firestore } from 'firebase-admin/firestore'
import type { AuditLog } from '@/types/auditLog'

const NON_USER_ACTORS = new Set(['system', 'anonymous', 'fallback', ''])

function collectUserIds(logs: AuditLog[]): string[] {
  const ids = new Set<string>()
  for (const log of logs) {
    if (!NON_USER_ACTORS.has(log.actorUid)) {
      ids.add(log.actorUid)
    }
    if (log.targetUid && !NON_USER_ACTORS.has(log.targetUid)) {
      ids.add(log.targetUid)
    }
  }
  return [...ids]
}

/**
 * Attach current display names for actor/target UIDs.
 * Names are resolved at read time so historical logs stay readable
 * without backfilling write-time snapshots.
 */
export async function enrichAuditLogsWithDisplayNames(
  adminDb: Firestore,
  logs: AuditLog[]
): Promise<AuditLog[]> {
  if (logs.length === 0) return logs

  const userIds = collectUserIds(logs)
  if (userIds.length === 0) return logs

  const refs = userIds.map(id => adminDb.collection('users').doc(id))
  const snaps = await adminDb.getAll(...refs)

  const namesByUid = new Map<string, string>()
  for (const snap of snaps) {
    if (!snap.exists) continue
    const data = snap.data()
    const displayName =
      typeof data?.displayName === 'string' ? data.displayName.trim() : ''
    if (displayName) {
      namesByUid.set(snap.id, displayName)
    }
  }

  if (namesByUid.size === 0) return logs

  return logs.map(log => {
    const actorDisplayName = namesByUid.get(log.actorUid)
    const targetDisplayName = log.targetUid
      ? namesByUid.get(log.targetUid)
      : undefined

    if (!actorDisplayName && !targetDisplayName) return log

    return {
      ...log,
      ...(actorDisplayName ? { actorDisplayName } : {}),
      ...(targetDisplayName ? { targetDisplayName } : {}),
    }
  })
}
