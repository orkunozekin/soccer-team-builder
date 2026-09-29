import type { Firestore } from 'firebase-admin/firestore'
import { normalizeJerseyNumber } from '@/lib/utils/jerseyNumber'
import { normalizeUserRole } from '@/types/user'
import type { User } from '@/types/user'

const GET_ALL_CHUNK = 100

function timestampToDate(value: unknown): Date {
  if (!value) return new Date()
  if (value instanceof Date) return value
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate()
  }
  return new Date()
}

function mapUserDoc(id: string, data: Record<string, unknown>): User {
  return {
    uid: (data.uid as string) ?? id,
    email: (data.email as string) ?? '',
    displayName: (data.displayName as string) ?? '',
    jerseyNumber: normalizeJerseyNumber(data.jerseyNumber),
    position: (data.position as string | null) ?? null,
    role: normalizeUserRole(data.role),
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt),
  }
}

/**
 * Load only the requested user docs via Admin `getAll` (chunked).
 * Prefer this over `collection('users').get()` when the caller already knows the uids.
 */
export async function getUsersByIdsAdmin(
  adminDb: Firestore,
  uids: Iterable<string>
): Promise<User[]> {
  const uniqueIds = Array.from(
    new Set(
      Array.from(uids).filter(
        (id): id is string => typeof id === 'string' && id.length > 0
      )
    )
  )
  if (uniqueIds.length === 0) return []

  const users: User[] = []
  for (let i = 0; i < uniqueIds.length; i += GET_ALL_CHUNK) {
    const chunk = uniqueIds.slice(i, i + GET_ALL_CHUNK)
    const refs = chunk.map(id => adminDb.collection('users').doc(id))
    const snaps = await adminDb.getAll(...refs)
    for (const snap of snaps) {
      if (!snap.exists) continue
      users.push(
        mapUserDoc(snap.id, (snap.data() ?? {}) as Record<string, unknown>)
      )
    }
  }
  return users
}

/** Position lookup for the given uids only (no full users collection scan). */
export async function getUserPositionsByIdsAdmin(
  adminDb: Firestore,
  uids: Iterable<string>
): Promise<Map<string, string | null>> {
  const users = await getUsersByIdsAdmin(adminDb, uids)
  return new Map(users.map(u => [u.uid, u.position ?? null]))
}
