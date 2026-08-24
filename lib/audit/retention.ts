import { Timestamp } from 'firebase-admin/firestore'
import type { Firestore } from 'firebase-admin/firestore'
import { auditLog } from '@/lib/services/auditService'

const DEFAULT_RETENTION_DAYS = 90
const BATCH_SIZE = 450
const MAX_BATCHES_PER_RUN = 10

export function getAuditLogRetentionDays(): number {
  const raw = process.env.AUDIT_LOG_RETENTION_DAYS?.trim()
  if (!raw) return DEFAULT_RETENTION_DAYS
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_RETENTION_DAYS
  return Math.min(Math.floor(parsed), 3650)
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export async function purgeExpiredAuditLogs(adminDb: Firestore): Promise<{
  ok: boolean
  retentionDays: number
  cutoff: string
  deleted: number
  batches: number
}> {
  const retentionDays = getAuditLogRetentionDays()
  const cutoffDate = new Date(
    Date.now() - retentionDays * 24 * 60 * 60 * 1000
  )
  const cutoff = Timestamp.fromDate(cutoffDate)

  let deleted = 0
  let batches = 0

  while (batches < MAX_BATCHES_PER_RUN) {
    const snap = await adminDb
      .collection('auditLogs')
      .where('createdAt', '<', cutoff)
      .limit(BATCH_SIZE)
      .get()

    if (snap.empty) break

    for (const batchDocs of chunk(snap.docs, 450)) {
      const batch = adminDb.batch()
      batchDocs.forEach(doc => batch.delete(doc.ref))
      await batch.commit()
      deleted += batchDocs.length
      batches += 1
    }

    if (snap.size < BATCH_SIZE) break
  }

  if (deleted > 0) {
    auditLog({
      action: 'cron.audit_retention',
      actorUid: 'system',
      source: 'cron',
      metadata: {
        deleted,
        retentionDays,
        cutoff: cutoffDate.toISOString(),
        batches,
      },
    })
  }

  return {
    ok: true,
    retentionDays,
    cutoff: cutoffDate.toISOString(),
    deleted,
    batches,
  }
}
