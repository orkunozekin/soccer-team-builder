import { Timestamp, type Firestore, type Query } from 'firebase-admin/firestore'
import type {
  AuditAction,
  AuditLog,
  AuditLogFilters,
  AuditSource,
} from '@/types/auditLog'

function timestampToIso(value: unknown): string {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  return new Date().toISOString()
}

function mapDoc(id: string, data: Record<string, unknown>): AuditLog {
  return {
    id,
    action: data.action as AuditAction,
    actorUid: (data.actorUid as string) ?? '',
    actorRole: data.actorRole as string | undefined,
    targetUid: data.targetUid as string | undefined,
    matchId: data.matchId as string | undefined,
    entityType: data.entityType as AuditLog['entityType'],
    entityId: data.entityId as string | undefined,
    metadata: data.metadata as Record<string, unknown> | undefined,
    source: data.source as AuditSource,
    createdAt: timestampToIso(data.createdAt),
  }
}

function buildFilteredQuery(
  adminDb: Firestore,
  filters: AuditLogFilters
) {
  let q: Query = adminDb.collection('auditLogs')

  if (filters.action) {
    q = q.where('action', '==', filters.action)
  }
  if (filters.source) {
    q = q.where('source', '==', filters.source)
  }
  if (filters.actorUid?.trim()) {
    q = q.where('actorUid', '==', filters.actorUid.trim())
  }
  if (filters.targetUid?.trim()) {
    q = q.where('targetUid', '==', filters.targetUid.trim())
  }
  if (filters.matchId?.trim()) {
    q = q.where('matchId', '==', filters.matchId.trim())
  }

  return q.orderBy('createdAt', 'desc')
}

export async function queryAuditLogs(
  adminDb: Firestore,
  options: {
    limit: number
    cursor?: string | null
    filters?: AuditLogFilters
  }
): Promise<{ logs: AuditLog[]; nextCursor: string | null }> {
  const filters = options.filters ?? {}
  const pageSize = Math.max(1, options.limit)
  let q = buildFilteredQuery(adminDb, filters).limit(pageSize + 1)

  if (options.cursor) {
    const cursorDate = new Date(options.cursor)
    if (!Number.isNaN(cursorDate.getTime())) {
      q = q.startAfter(Timestamp.fromDate(cursorDate))
    }
  }

  const snap = await q.get()
  const docs = snap.docs
  const hasMore = docs.length > pageSize
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs

  const logs = pageDocs.map(doc => mapDoc(doc.id, doc.data()))
  const nextCursor =
    hasMore && logs.length > 0 ? logs[logs.length - 1]!.createdAt : null

  return { logs, nextCursor }
}

export async function countAuditLogs(
  adminDb: Firestore,
  filters?: AuditLogFilters
): Promise<number> {
  const q = buildFilteredQuery(adminDb, filters ?? {})
  const snap = await q.count().get()
  return snap.data().count
}
