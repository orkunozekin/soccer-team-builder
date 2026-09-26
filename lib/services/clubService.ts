import { Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import type {
  Club,
  ClubInvite,
  ClubInviteCreatorRole,
  ClubMembership,
  ClubMembershipRole,
  ClubMembershipWithClub,
  ClubSettings,
} from '@/types/club'

const DEFAULT_SETTINGS: ClubSettings = {
  allowPlayerInvites: false,
}

/** URL-safe slug: lowercase letters, numbers, hyphens */
export function slugifyClubName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export function membershipDocId(clubId: string, userId: string): string {
  return `${clubId}_${userId}`
}

function mapClub(id: string, data: Record<string, any>): Club {
  return {
    id,
    name: (data.name as string) ?? '',
    slug: (data.slug as string) ?? '',
    createdBy: (data.createdBy as string) ?? '',
    settings: {
      allowPlayerInvites: Boolean(
        data.settings?.allowPlayerInvites ?? DEFAULT_SETTINGS.allowPlayerInvites
      ),
    },
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
  }
}

function mapMembership(
  id: string,
  data: Record<string, any>
): ClubMembership {
  return {
    id,
    clubId: data.clubId as string,
    userId: data.userId as string,
    role: data.role as ClubMembershipRole,
    status: 'active',
    joinedAt: data.joinedAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
  }
}

export async function createClub(input: {
  name: string
  slug?: string
  createdBy: string
  settings?: Partial<ClubSettings>
}): Promise<Club> {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Firebase Admin not configured')

  const name = input.name.trim()
  if (!name) throw new Error('Club name is required')

  const slug = (input.slug?.trim() || slugifyClubName(name)).toLowerCase()
  if (!slug) throw new Error('Club slug is required')

  const existing = await adminDb
    .collection('clubs')
    .where('slug', '==', slug)
    .limit(1)
    .get()
  if (!existing.empty) {
    throw new Error('Club slug already exists')
  }

  const clubRef = adminDb.collection('clubs').doc()
  const now = Timestamp.now()
  const settings: ClubSettings = {
    allowPlayerInvites:
      input.settings?.allowPlayerInvites ?? DEFAULT_SETTINGS.allowPlayerInvites,
  }

  await clubRef.set({
    name,
    slug,
    createdBy: input.createdBy,
    settings,
    createdAt: now,
    updatedAt: now,
  })

  // Creator becomes club_admin
  await upsertMembership({
    clubId: clubRef.id,
    userId: input.createdBy,
    role: 'club_admin',
  })

  return mapClub(clubRef.id, {
    name,
    slug,
    createdBy: input.createdBy,
    settings,
    createdAt: now,
    updatedAt: now,
  })
}

export async function getClub(clubId: string): Promise<Club | null> {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Firebase Admin not configured')
  const snap = await adminDb.collection('clubs').doc(clubId).get()
  if (!snap.exists) return null
  return mapClub(snap.id, snap.data()!)
}

export async function updateClub(
  clubId: string,
  updates: { name?: string; settings?: Partial<ClubSettings> }
): Promise<Club> {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Firebase Admin not configured')

  const ref = adminDb.collection('clubs').doc(clubId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Club not found')

  const patch: Record<string, unknown> = { updatedAt: Timestamp.now() }
  if (typeof updates.name === 'string' && updates.name.trim()) {
    patch.name = updates.name.trim()
  }
  if (updates.settings) {
    const current = snap.data()?.settings ?? DEFAULT_SETTINGS
    patch.settings = {
      allowPlayerInvites:
        updates.settings.allowPlayerInvites ??
        Boolean(current.allowPlayerInvites),
    }
  }

  await ref.update(patch)
  const next = await ref.get()
  return mapClub(next.id, next.data()!)
}

export async function upsertMembership(input: {
  clubId: string
  userId: string
  role: ClubMembershipRole
}): Promise<{ membership: ClubMembership; created: boolean }> {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Firebase Admin not configured')

  const id = membershipDocId(input.clubId, input.userId)
  const ref = adminDb.collection('clubMemberships').doc(id)
  const existing = await ref.get()
  const now = Timestamp.now()

  if (existing.exists) {
    await ref.update({
      role: input.role,
      status: 'active',
      updatedAt: now,
    })
    const data = { ...existing.data(), role: input.role, updatedAt: now }
    return { membership: mapMembership(id, data!), created: false }
  }

  const data = {
    clubId: input.clubId,
    userId: input.userId,
    role: input.role,
    status: 'active',
    joinedAt: now,
    updatedAt: now,
  }
  await ref.set(data)
  return { membership: mapMembership(id, data), created: true }
}

export async function listMembershipsForUser(
  userId: string
): Promise<ClubMembershipWithClub[]> {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Firebase Admin not configured')

  const snap = await adminDb
    .collection('clubMemberships')
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .get()

  const results: ClubMembershipWithClub[] = []
  for (const doc of snap.docs) {
    const membership = mapMembership(doc.id, doc.data())
    const club = await getClub(membership.clubId)
    if (!club) continue
    results.push({
      ...membership,
      club: {
        id: club.id,
        name: club.name,
        slug: club.slug,
        settings: club.settings,
      },
    })
  }

  results.sort((a, b) => a.club.name.localeCompare(b.club.name))
  return results
}

/** Generate a short uppercase invite code (e.g. ABCD12) */
export function generateInviteCode(length = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code
}

export async function createInvite(input: {
  clubId: string
  createdBy: string
  createdByRole: ClubInviteCreatorRole
  maxUses?: number | null
  expiresAt?: Date | null
}): Promise<ClubInvite> {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Firebase Admin not configured')

  // Ensure unique code (retry a few times)
  let code = generateInviteCode()
  for (let attempt = 0; attempt < 8; attempt++) {
    const clash = await adminDb
      .collection('clubInvites')
      .where('code', '==', code)
      .limit(1)
      .get()
    if (clash.empty) break
    code = generateInviteCode()
  }

  const ref = adminDb.collection('clubInvites').doc()
  const now = Timestamp.now()
  const data = {
    clubId: input.clubId,
    code,
    createdBy: input.createdBy,
    createdByRole: input.createdByRole,
    maxUses: input.maxUses ?? null,
    useCount: 0,
    expiresAt: input.expiresAt ? Timestamp.fromDate(input.expiresAt) : null,
    revokedAt: null,
    createdAt: now,
  }
  await ref.set(data)

  return {
    id: ref.id,
    clubId: input.clubId,
    code,
    createdBy: input.createdBy,
    createdByRole: input.createdByRole,
    maxUses: input.maxUses ?? null,
    useCount: 0,
    expiresAt: input.expiresAt ?? null,
    revokedAt: null,
    createdAt: now.toDate(),
  }
}

export async function findActiveInviteByCode(
  code: string
): Promise<ClubInvite | null> {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Firebase Admin not configured')

  const normalized = code.trim().toUpperCase()
  if (!normalized) return null

  const snap = await adminDb
    .collection('clubInvites')
    .where('code', '==', normalized)
    .limit(5)
    .get()

  const now = Date.now()
  for (const doc of snap.docs) {
    const data = doc.data()
    if (data.revokedAt) continue
    if (data.expiresAt?.toDate && data.expiresAt.toDate().getTime() < now) {
      continue
    }
    if (
      typeof data.maxUses === 'number' &&
      data.maxUses > 0 &&
      (data.useCount ?? 0) >= data.maxUses
    ) {
      continue
    }
    return {
      id: doc.id,
      clubId: data.clubId as string,
      code: data.code as string,
      createdBy: data.createdBy as string,
      createdByRole: data.createdByRole as ClubInviteCreatorRole,
      maxUses: (data.maxUses as number | null) ?? null,
      useCount: (data.useCount as number) ?? 0,
      expiresAt: data.expiresAt?.toDate?.() ?? null,
      revokedAt: data.revokedAt?.toDate?.() ?? null,
      createdAt: data.createdAt?.toDate?.() ?? new Date(),
    }
  }
  return null
}

export type RedeemInviteResult =
  | { ok: true; membership: ClubMembership; alreadyMember: boolean; clubId: string }
  | { ok: false; error: string; status: number }

/**
 * Redeem invite by code. Idempotent if already an active member.
 */
export async function redeemInvite(input: {
  code: string
  userId: string
}): Promise<RedeemInviteResult> {
  const invite = await findActiveInviteByCode(input.code)
  if (!invite) {
    return { ok: false, error: 'Invalid or expired invite code', status: 400 }
  }

  const existingId = membershipDocId(invite.clubId, input.userId)
  const adminDb = getAdminDb()
  if (!adminDb) {
    return { ok: false, error: 'Firebase Admin not configured', status: 500 }
  }

  const existing = await adminDb
    .collection('clubMemberships')
    .doc(existingId)
    .get()
  if (existing.exists && existing.data()?.status === 'active') {
    return {
      ok: true,
      membership: mapMembership(existingId, existing.data()!),
      alreadyMember: true,
      clubId: invite.clubId,
    }
  }

  const { membership } = await upsertMembership({
    clubId: invite.clubId,
    userId: input.userId,
    role: 'player',
  })

  await adminDb
    .collection('clubInvites')
    .doc(invite.id)
    .update({
      useCount: (invite.useCount ?? 0) + 1,
    })

  // Set activeClubId if unset
  const userRef = adminDb.collection('users').doc(input.userId)
  const userSnap = await userRef.get()
  if (userSnap.exists && !userSnap.data()?.activeClubId) {
    await userRef.update({
      activeClubId: invite.clubId,
      updatedAt: Timestamp.now(),
    })
  }

  return {
    ok: true,
    membership,
    alreadyMember: false,
    clubId: invite.clubId,
  }
}

export type BackfillResult = {
  clubId: string
  usersProcessed: number
  membershipsCreated: number
  membershipsUpdated: number
  rolesPromotedToSuperUser: number
  matchesUpdated: number
  schedulesUpdated: number
  locationsUpdated: number
}

/**
 * One-shot: attach all users to clubId; promote legacy admin → super_user + club_admin;
 * stamp clubId onto matches/schedules/locations missing it.
 */
export async function backfillClubMemberships(
  clubId: string
): Promise<BackfillResult> {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Firebase Admin not configured')

  const club = await getClub(clubId)
  if (!club) throw new Error('Club not found')

  const usersSnap = await adminDb.collection('users').get()
  let membershipsCreated = 0
  let membershipsUpdated = 0
  let rolesPromotedToSuperUser = 0

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data()
    const role = data.role
    const wasAdminOrSuper = role === 'admin' || role === 'super_user'
    const membershipRole: ClubMembershipRole = wasAdminOrSuper
      ? 'club_admin'
      : 'player'

    if (role === 'admin') {
      await userDoc.ref.update({
        role: 'super_user',
        updatedAt: Timestamp.now(),
      })
      rolesPromotedToSuperUser += 1
    }

    const { created } = await upsertMembership({
      clubId,
      userId: userDoc.id,
      role: membershipRole,
    })
    if (created) membershipsCreated += 1
    else membershipsUpdated += 1

    if (!data.activeClubId) {
      await userDoc.ref.update({
        activeClubId: clubId,
        updatedAt: Timestamp.now(),
      })
    }
  }

  async function stampClubId(collectionName: string): Promise<number> {
    const db = getAdminDb()
    if (!db) throw new Error('Firebase Admin not configured')
    const snap = await db.collection(collectionName).get()
    let updated = 0
    for (const doc of snap.docs) {
      const existing = doc.data()?.clubId
      if (typeof existing === 'string' && existing.length > 0) continue
      await doc.ref.update({ clubId, updatedAt: Timestamp.now() })
      updated += 1
    }
    return updated
  }

  const matchesUpdated = await stampClubId('matches')
  const schedulesUpdated = await stampClubId('schedules')
  const locationsUpdated = await stampClubId('savedLocations')

  return {
    clubId,
    usersProcessed: usersSnap.size,
    membershipsCreated,
    membershipsUpdated,
    rolesPromotedToSuperUser,
    matchesUpdated,
    schedulesUpdated,
    locationsUpdated,
  }
}
