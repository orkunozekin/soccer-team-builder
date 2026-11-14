import { type Firestore, Timestamp } from 'firebase-admin/firestore'
import { CODE_OF_CONDUCT_VERSION } from '@/lib/conduct/codeOfConduct'
import type { CodeOfConductAgreementDTO } from '@/types/conduct'

/**
 * Admin-SDK access to code of conduct agreements. Firestore rules deny all
 * client access; API routes enforce who may read or write.
 */
export const CODE_OF_CONDUCT_AGREEMENTS_COLLECTION = 'codeOfConductAgreements'

function timestampToIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString()
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }
  return null
}

function mapAgreement(
  data: FirebaseFirestore.DocumentData | undefined
): CodeOfConductAgreementDTO | null {
  if (!data || typeof data.version !== 'string' || !data.version) return null
  return { version: data.version, agreedAt: timestampToIso(data.agreedAt) }
}

/** The user's agreement, or null when they never agreed. */
export async function getCodeOfConductAgreement(
  adminDb: Firestore,
  userId: string
): Promise<CodeOfConductAgreementDTO | null> {
  const snap = await adminDb
    .collection(CODE_OF_CONDUCT_AGREEMENTS_COLLECTION)
    .doc(userId)
    .get()
  return snap.exists ? mapAgreement(snap.data()) : null
}

/**
 * Record that `userId` agreed to the current version. Keeps the first
 * agreement when one already exists (agreeing is once per member).
 */
export async function recordCodeOfConductAgreement(
  adminDb: Firestore,
  userId: string,
  context: { clubId: string; matchId: string }
): Promise<{ agreement: CodeOfConductAgreementDTO; created: boolean }> {
  const ref = adminDb
    .collection(CODE_OF_CONDUCT_AGREEMENTS_COLLECTION)
    .doc(userId)
  return adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref)
    const existing = snap.exists ? mapAgreement(snap.data()) : null
    if (existing) return { agreement: existing, created: false }
    const agreedAt = Timestamp.now()
    tx.set(ref, {
      userId,
      version: CODE_OF_CONDUCT_VERSION,
      agreedAt,
      clubId: context.clubId,
      matchId: context.matchId,
    })
    return {
      agreement: {
        version: CODE_OF_CONDUCT_VERSION,
        agreedAt: agreedAt.toDate().toISOString(),
      },
      created: true,
    }
  })
}

/** Whether the club has opted in to requiring the code of conduct. */
export async function clubRequiresCodeOfConduct(
  adminDb: Firestore,
  clubId: string
): Promise<boolean> {
  const snap = await adminDb.collection('clubs').doc(clubId).get()
  return snap.exists && snap.data()?.settings?.requireCodeOfConduct === true
}

export type CodeOfConductGate = { ok: true; agreedNow: boolean } | { ok: false }

/**
 * RSVP gate. Passes when the club doesn't require the code, the member
 * already agreed, or the request accepts the current version (which is then
 * recorded). `acceptVersion` must match exactly so a client showing old text
 * can't agree on the member's behalf.
 */
export async function checkCodeOfConductForRsvp(
  adminDb: Firestore,
  input: {
    clubId: string | null
    matchId: string
    userId: string
    acceptVersion: unknown
  }
): Promise<CodeOfConductGate> {
  if (!input.clubId) return { ok: true, agreedNow: false }
  if (!(await clubRequiresCodeOfConduct(adminDb, input.clubId))) {
    return { ok: true, agreedNow: false }
  }
  if (await getCodeOfConductAgreement(adminDb, input.userId)) {
    return { ok: true, agreedNow: false }
  }
  if (input.acceptVersion !== CODE_OF_CONDUCT_VERSION) return { ok: false }
  const { created } = await recordCodeOfConductAgreement(
    adminDb,
    input.userId,
    { clubId: input.clubId, matchId: input.matchId }
  )
  return { ok: true, agreedNow: created }
}
