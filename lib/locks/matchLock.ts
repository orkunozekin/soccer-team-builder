/**
 * Per-match lock for serializing team regeneration (expandTeamsForMatch).
 * Uses a Firestore document so it works across serverless instances (e.g. Vercel).
 */

import { Timestamp } from 'firebase-admin/firestore'
import type { Firestore } from 'firebase-admin/firestore'

const LOCK_DOC_ID = 'regeneration'
const DEFAULT_TTL_SECONDS = 30
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_RETRY_DELAY_MS = 500

function lockRef(adminDb: Firestore, matchId: string) {
  return adminDb
    .collection('matches')
    .doc(matchId)
    .collection('_lock')
    .doc(LOCK_DOC_ID)
}

export interface AcquireMatchLockOptions {
  ttlSeconds?: number
  maxRetries?: number
  retryDelayMs?: number
}

export interface MatchLock {
  release: () => Promise<void>
}

/**
 * Acquire a per-match lock. Retries with backoff if the lock is held.
 * Returns a lock with release(), or null if lock could not be acquired after retries.
 */
export async function acquireMatchLock(
  adminDb: Firestore,
  matchId: string,
  options: AcquireMatchLockOptions = {}
): Promise<MatchLock | null> {
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS

  const holderId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? (crypto as { randomUUID: () => string }).randomUUID()
      : `lock_${Date.now()}_${Math.random().toString(36).slice(2)}`

  const ref = lockRef(adminDb, matchId)
  const now = Timestamp.now()
  const expiryCutoff = new Date(now.toMillis() - ttlSeconds * 1000)

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const acquired = await adminDb.runTransaction(async tx => {
        const snap = await tx.get(ref)
        const data = snap.data()
        if (
          data?.heldAt &&
          (data.heldAt as Timestamp).toMillis() > expiryCutoff.getTime()
        ) {
          return false // lock held
        }
        tx.set(ref, { holder: holderId, heldAt: now })
        return true
      })
      if (acquired) {
        return {
          release: async () => {
            const snap = await ref.get()
            if (snap.exists && snap.data()?.holder === holderId) {
              await ref.delete()
            }
          },
        }
      }
    } catch {
      // transaction failed, retry
    }
    if (attempt < maxRetries - 1) {
      await new Promise(r => setTimeout(r, retryDelayMs))
    }
  }
  return null
}
