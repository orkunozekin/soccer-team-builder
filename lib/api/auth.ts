import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin'
import { normalizeUserRole } from '@/types/user'
import type { ClubMembership, ClubMembershipRole } from '@/types/club'

/**
 * Get the current user's auth token from the request
 */
export async function getAuthToken(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7)
}

/**
 * Verify the user is authenticated using Firebase Admin SDK
 * This provides proper server-side token verification
 */
export async function verifyAuth(request: Request): Promise<{
  uid: string | null
  email: string | null
  error: string | null
}> {
  const token = await getAuthToken(request)
  if (!token) {
    return { uid: null, email: null, error: 'No authorization token provided' }
  }

  try {
    // Use Firebase Admin SDK to verify the token
    const adminAuth = getAdminAuth()

    // If Admin SDK is not configured, fall back to client SDK approach
    if (!adminAuth) {
      // Fallback: Accept token but rely on Firestore security rules
      // This is less secure but allows development without service account
      console.warn(
        'Firebase Admin SDK not configured, using fallback verification'
      )
      return { uid: 'fallback', email: null, error: null }
    }

    const decodedToken = await adminAuth.verifyIdToken(token)
    return {
      uid: decodedToken.uid,
      email: typeof decodedToken.email === 'string' ? decodedToken.email : null,
      error: null,
    }
  } catch (error: any) {
    const message = error?.message ?? String(error)
    console.error('Token verification error:', message)
    return {
      uid: null,
      email: null,
      error: message?.includes('auth/') ? message : 'Invalid or expired token',
    }
  }
}

async function isGlobalSuperUser(uid: string): Promise<boolean | null> {
  const adminDb = getAdminDb()
  if (!adminDb) return null

  const userDoc = await adminDb.collection('users').doc(uid).get()
  if (!userDoc.exists) return false

  return normalizeUserRole(userDoc.data()?.role) === 'super_user'
}

/**
 * Verify the user has the global super_user role (platform operator).
 * Replaces the former verifyAdmin / role === 'admin' check.
 */
export async function verifySuperUser(request: Request): Promise<{
  uid: string | null
  email: string | null
  isSuperUser: boolean
  error: string | null
}> {
  const { uid, email, error } = await verifyAuth(request)
  if (error || !uid) {
    return { uid: null, email: null, isSuperUser: false, error }
  }

  if (uid === 'fallback') {
    return { uid, email, isSuperUser: false, error: null }
  }

  try {
    const result = await isGlobalSuperUser(uid)
    if (result === null) {
      return { uid, email, isSuperUser: false, error: null }
    }
    return { uid, email, isSuperUser: result, error: null }
  } catch (err: any) {
    console.error('Super user verification error:', err)
    return {
      uid,
      email,
      isSuperUser: false,
      error: 'Failed to verify super user status',
    }
  }
}

export type MembershipLookup = {
  membership: ClubMembership | null
  isSuperUser: boolean
}

/**
 * Load active membership for (uid, clubId). Super users skip membership.
 */
export async function getActiveClubMembership(
  uid: string,
  clubId: string
): Promise<MembershipLookup> {
  const adminDb = getAdminDb()
  if (!adminDb) {
    return { membership: null, isSuperUser: false }
  }

  const superUser = await isGlobalSuperUser(uid)
  if (superUser) {
    return { membership: null, isSuperUser: true }
  }

  const snap = await adminDb
    .collection('clubMemberships')
    .where('clubId', '==', clubId)
    .where('userId', '==', uid)
    .where('status', '==', 'active')
    .limit(1)
    .get()

  if (snap.empty) {
    return { membership: null, isSuperUser: false }
  }

  const doc = snap.docs[0]
  const data = doc.data()
  const membership: ClubMembership = {
    id: doc.id,
    clubId: data.clubId as string,
    userId: data.userId as string,
    role: data.role as ClubMembershipRole,
    status: 'active',
    joinedAt: data.joinedAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
  }

  return { membership, isSuperUser: false }
}

/**
 * Verify active membership in clubId (or global super_user).
 * When clubId is missing (pre-backfill), only super_user passes.
 */
export async function verifyClubMember(
  request: Request,
  clubId: string | null | undefined
): Promise<{
  uid: string | null
  isMember: boolean
  isSuperUser: boolean
  membership: ClubMembership | null
  error: string | null
}> {
  const { uid, error } = await verifyAuth(request)
  if (error || !uid) {
    return {
      uid: null,
      isMember: false,
      isSuperUser: false,
      membership: null,
      error,
    }
  }

  if (uid === 'fallback') {
    return {
      uid,
      isMember: false,
      isSuperUser: false,
      membership: null,
      error: null,
    }
  }

  try {
    if (!clubId) {
      const superUser = (await isGlobalSuperUser(uid)) === true
      return {
        uid,
        isMember: superUser,
        isSuperUser: superUser,
        membership: null,
        error: null,
      }
    }

    const { membership, isSuperUser } = await getActiveClubMembership(
      uid,
      clubId
    )
    const isMember = isSuperUser || membership != null
    return { uid, isMember, isSuperUser, membership, error: null }
  } catch (err: any) {
    console.error('Club member verification error:', err)
    return {
      uid,
      isMember: false,
      isSuperUser: false,
      membership: null,
      error: 'Failed to verify club membership',
    }
  }
}

/**
 * Verify club_admin for clubId (or global super_user).
 * When clubId is missing (pre-backfill), only super_user passes.
 */
export async function verifyClubAdmin(
  request: Request,
  clubId: string | null | undefined
): Promise<{
  uid: string | null
  isClubAdmin: boolean
  isSuperUser: boolean
  membership: ClubMembership | null
  error: string | null
}> {
  const result = await verifyClubMember(request, clubId)
  if (result.error || !result.uid) {
    return {
      uid: result.uid,
      isClubAdmin: false,
      isSuperUser: false,
      membership: null,
      error: result.error,
    }
  }

  if (result.isSuperUser) {
    return {
      uid: result.uid,
      isClubAdmin: true,
      isSuperUser: true,
      membership: result.membership,
      error: null,
    }
  }

  const isClubAdmin = result.membership?.role === 'club_admin'
  return {
    uid: result.uid,
    isClubAdmin,
    isSuperUser: false,
    membership: result.membership,
    error: null,
  }
}

/**
 * Invite create gate: club_admin always; player only if allowPlayerInvites.
 * Super users may always create invites.
 */
export async function verifyCanCreateInvite(
  request: Request,
  clubId: string
): Promise<{
  uid: string | null
  allowed: boolean
  createdByRole: 'club_admin' | 'player' | 'super_user' | null
  error: string | null
}> {
  const { uid, error } = await verifyAuth(request)
  if (error || !uid) {
    return { uid: null, allowed: false, createdByRole: null, error }
  }

  if (uid === 'fallback') {
    return { uid, allowed: false, createdByRole: null, error: null }
  }

  try {
    const adminDb = getAdminDb()
    if (!adminDb) {
      return { uid, allowed: false, createdByRole: null, error: null }
    }

    const superUser = await isGlobalSuperUser(uid)
    if (superUser) {
      return { uid, allowed: true, createdByRole: 'super_user', error: null }
    }

    const { membership } = await getActiveClubMembership(uid, clubId)
    if (!membership) {
      return { uid, allowed: false, createdByRole: null, error: null }
    }

    if (membership.role === 'club_admin') {
      return { uid, allowed: true, createdByRole: 'club_admin', error: null }
    }

    const clubSnap = await adminDb.collection('clubs').doc(clubId).get()
    if (!clubSnap.exists) {
      return { uid, allowed: false, createdByRole: null, error: 'Club not found' }
    }

    const allowPlayerInvites = Boolean(
      clubSnap.data()?.settings?.allowPlayerInvites
    )
    if (allowPlayerInvites) {
      return { uid, allowed: true, createdByRole: 'player', error: null }
    }

    return { uid, allowed: false, createdByRole: null, error: null }
  } catch (err: any) {
    console.error('Invite create verification error:', err)
    return {
      uid,
      allowed: false,
      createdByRole: null,
      error: 'Failed to verify invite permission',
    }
  }
}

/**
 * Load clubId from a match document (Admin SDK).
 */
export async function getMatchClubId(
  matchId: string
): Promise<string | null> {
  const adminDb = getAdminDb()
  if (!adminDb) return null
  const snap = await adminDb.collection('matches').doc(matchId).get()
  if (!snap.exists) return null
  const clubId = snap.data()?.clubId
  return typeof clubId === 'string' && clubId.length > 0 ? clubId : null
}

/**
 * Resolve clubId for write operations.
 * Prefer explicit clubId; for super_user, fall back to users.activeClubId or the sole club.
 */
export async function resolveClubIdForWrite(
  uid: string,
  clubIdFromRequest: string | null | undefined
): Promise<{ clubId: string | null; error: string | null }> {
  const explicit =
    typeof clubIdFromRequest === 'string' ? clubIdFromRequest.trim() : ''
  if (explicit) return { clubId: explicit, error: null }

  const adminDb = getAdminDb()
  if (!adminDb) return { clubId: null, error: 'Firebase Admin not configured' }

  const userSnap = await adminDb.collection('users').doc(uid).get()
  const activeClubId = userSnap.data()?.activeClubId
  if (typeof activeClubId === 'string' && activeClubId.length > 0) {
    return { clubId: activeClubId, error: null }
  }

  const clubsSnap = await adminDb.collection('clubs').limit(2).get()
  if (clubsSnap.size === 1) {
    return { clubId: clubsSnap.docs[0].id, error: null }
  }
  if (clubsSnap.empty) {
    return {
      clubId: null,
      error: 'No clubs exist yet. Create a club first.',
    }
  }
  return {
    clubId: null,
    error: 'clubId is required when multiple clubs exist',
  }
}

/**
 * Club-admin check for a match: resolves match.clubId then verifyClubAdmin.
 * Missing clubId (pre-backfill) → super_user only.
 */
export async function verifyClubAdminForMatch(
  request: Request,
  matchId: string
): Promise<{
  uid: string | null
  isClubAdmin: boolean
  isSuperUser: boolean
  clubId: string | null
  error: string | null
  matchExists: boolean
}> {
  const adminDb = getAdminDb()
  if (!adminDb) {
    const auth = await verifyAuth(request)
    return {
      uid: auth.uid,
      isClubAdmin: false,
      isSuperUser: false,
      clubId: null,
      error: auth.error,
      matchExists: false,
    }
  }

  const snap = await adminDb.collection('matches').doc(matchId).get()
  if (!snap.exists || snap.data()?.deletedAt != null) {
    const auth = await verifyAuth(request)
    return {
      uid: auth.uid,
      isClubAdmin: false,
      isSuperUser: false,
      clubId: null,
      error: auth.error,
      matchExists: false,
    }
  }

  const raw = snap.data()?.clubId
  const clubId =
    typeof raw === 'string' && raw.length > 0 ? raw : null

  const result = await verifyClubAdmin(request, clubId)
  return {
    uid: result.uid,
    isClubAdmin: result.isClubAdmin,
    isSuperUser: result.isSuperUser,
    clubId,
    error: result.error,
    matchExists: true,
  }
}
