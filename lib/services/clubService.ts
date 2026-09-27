import { Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebase/admin'
import {
  type ClubBrandingPatch,
  mergeClubBranding,
  readStoredBranding,
} from '@/lib/utils/clubBranding'
import type {
  Club,
  ClubInvite,
  ClubInviteCreatorRole,
  ClubMembership,
  ClubMembershipRole,
  ClubMembershipWithClub,
  ClubMembershipWithUser,
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

function mapSettings(raw: unknown): ClubSettings {
  const record =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const branding = readStoredBranding(record.branding)
  return {
    allowPlayerInvites: Boolean(
      record.allowPlayerInvites ?? DEFAULT_SETTINGS.allowPlayerInvites
    ),
    ...(branding ? { branding } : {}),
  }
}

function mapClub(id: string, data: Record<string, any>): Club {
  return {
    id,
    name: (data.name as string) ?? '',
    slug: (data.slug as string) ?? '',
    createdBy: (data.createdBy as string) ?? '',
    settings: mapSettings(data.settings),
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

async function assertUniqueClubName(
  name: string,
  excludeClubId?: string
): Promise<void> {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Firebase Admin not configured')

  const trimmed = name.trim()
  const nameLower = trimmed.toLowerCase()
  const [byLower, byExact] = await Promise.all([
    adminDb.collection('clubs').where('nameLower', '==', nameLower).limit(5).get(),
    adminDb.collection('clubs').where('name', '==', trimmed).limit(5).get(),
  ])
  const seen = new Set<string>()
  for (const doc of [...byLower.docs, ...byExact.docs]) {
    if (doc.id === excludeClubId || seen.has(doc.id)) continue
    seen.add(doc.id)
    throw new Error('Club name already exists')
  }
}

async function assertUniqueClubSlug(
  slug: string,
  excludeClubId?: string
): Promise<void> {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Firebase Admin not configured')

  const existing = await adminDb
    .collection('clubs')
    .where('slug', '==', slug)
    .limit(5)
    .get()
  const clash = existing.docs.find(d => d.id !== excludeClubId)
  if (clash) {
    throw new Error('Club slug already exists')
  }
}

export async function createClub(input: {
  name: string
  createdBy: string
  settings?: Partial<ClubSettings>
}): Promise<Club> {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Firebase Admin not configured')

  const name = input.name.trim()
  if (!name) throw new Error('Club name is required')

  const slug = slugifyClubName(name)
  if (!slug) {
    throw new Error('Club name must include letters or numbers')
  }

  await assertUniqueClubName(name)
  await assertUniqueClubSlug(slug)

  const clubRef = adminDb.collection('clubs').doc()
  const now = Timestamp.now()
  const settings: ClubSettings = {
    allowPlayerInvites:
      input.settings?.allowPlayerInvites ?? DEFAULT_SETTINGS.allowPlayerInvites,
  }

  await clubRef.set({
    name,
    nameLower: name.toLowerCase(),
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

/** Look up a club by its unique URL slug. Returns null when missing. */
export async function getClubBySlug(slug: string): Promise<Club | null> {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Firebase Admin not configured')

  const normalized = slug.trim().toLowerCase()
  if (!normalized) return null

  const snap = await adminDb
    .collection('clubs')
    .where('slug', '==', normalized)
    .limit(1)
    .get()

  if (snap.empty) return null
  const doc = snap.docs[0]
  return mapClub(doc.id, doc.data())
}

export async function updateClub(
  clubId: string,
  updates: {
    name?: string
    settings?: {
      allowPlayerInvites?: boolean
      branding?: ClubBrandingPatch
    }
  }
): Promise<Club> {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Firebase Admin not configured')

  const ref = adminDb.collection('clubs').doc(clubId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Club not found')

  const patch: Record<string, unknown> = { updatedAt: Timestamp.now() }
  if (typeof updates.name === 'string' && updates.name.trim()) {
    const name = updates.name.trim()
    const slug = slugifyClubName(name)
    if (!slug) {
      throw new Error('Club name must include letters or numbers')
    }
    await assertUniqueClubName(name, clubId)
    await assertUniqueClubSlug(slug, clubId)
    patch.name = name
    patch.nameLower = name.toLowerCase()
    patch.slug = slug
  }
  if (updates.settings) {
    // Rewrite the whole settings object so a cleared branding field does not linger,
    // while keeping allowPlayerInvites and branding that this patch did not touch.
    const current = mapSettings(snap.data()?.settings)
    const branding = mergeClubBranding(
      current.branding,
      updates.settings.branding
    )
    const settings: ClubSettings = {
      allowPlayerInvites:
        updates.settings.allowPlayerInvites ?? current.allowPlayerInvites,
    }
    if (branding) settings.branding = branding
    patch.settings = settings
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

/**
 * Idempotent: set nameLower from name when missing (founding clubs created
 * before uniqueness indexing).
 */
export async function ensureClubNameLower(clubId: string): Promise<boolean> {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Firebase Admin not configured')

  const ref = adminDb.collection('clubs').doc(clubId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Club not found')

  const data = snap.data()!
  const name = typeof data.name === 'string' ? data.name.trim() : ''
  if (!name) return false
  const existing =
    typeof data.nameLower === 'string' ? data.nameLower.trim() : ''
  const expected = name.toLowerCase()
  if (existing === expected) return false

  await ref.update({
    nameLower: expected,
    updatedAt: Timestamp.now(),
  })
  return true
}

export async function listMembershipsForClub(
  clubId: string
): Promise<ClubMembershipWithUser[]> {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Firebase Admin not configured')

  const snap = await adminDb
    .collection('clubMemberships')
    .where('clubId', '==', clubId)
    .where('status', '==', 'active')
    .get()

  const memberships = snap.docs.map(doc =>
    mapMembership(doc.id, doc.data())
  )

  // Batch-fetch user docs (sequential gets are too slow for large clubs).
  // Firestore getAll caps around 100 refs per call.
  const GET_ALL_CHUNK = 100
  const usersById = new Map<string, Record<string, unknown> | null>()
  for (let i = 0; i < memberships.length; i += GET_ALL_CHUNK) {
    const chunk = memberships.slice(i, i + GET_ALL_CHUNK)
    const refs = chunk.map(m => adminDb.collection('users').doc(m.userId))
    const userSnaps = await adminDb.getAll(...refs)
    for (const s of userSnaps) {
      usersById.set(
        s.id,
        s.exists ? ((s.data() ?? null) as Record<string, unknown> | null) : null
      )
    }
  }

  const results: ClubMembershipWithUser[] = memberships.map(membership => {
    const userData = usersById.get(membership.userId) ?? null
    return {
      ...membership,
      displayName:
        (userData?.displayName as string | undefined)?.trim() ||
        (userData?.email as string | undefined) ||
        membership.userId,
      email: (userData?.email as string | undefined) ?? '',
    }
  })

  results.sort((a, b) => {
    if (a.role !== b.role) {
      return a.role === 'club_admin' ? -1 : 1
    }
    return a.displayName.localeCompare(b.displayName)
  })
  return results
}

/**
 * Update a member's club role. Prevents demoting the last club_admin.
 * Last-admin check + role write run in a transaction so concurrent demotions
 * cannot leave the club with zero admins.
 */
export async function updateMembershipRole(input: {
  clubId: string
  userId: string
  role: ClubMembershipRole
}): Promise<ClubMembership> {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Firebase Admin not configured')

  const id = membershipDocId(input.clubId, input.userId)
  const ref = adminDb.collection('clubMemberships').doc(id)

  return adminDb.runTransaction(async tx => {
    const existing = await tx.get(ref)
    if (!existing.exists || existing.data()?.status !== 'active') {
      throw new Error('Membership not found')
    }

    const currentRole = existing.data()?.role as ClubMembershipRole
    if (currentRole === input.role) {
      return mapMembership(id, existing.data()!)
    }

    if (currentRole === 'club_admin' && input.role === 'player') {
      const adminsQuery = adminDb
        .collection('clubMemberships')
        .where('clubId', '==', input.clubId)
        .where('status', '==', 'active')
        .where('role', '==', 'club_admin')
        .limit(2)
      const admins = await tx.get(adminsQuery)
      if (admins.size <= 1) {
        throw new Error('Cannot demote the last club admin')
      }
    }

    const now = Timestamp.now()
    tx.update(ref, { role: input.role, updatedAt: now })
    return mapMembership(id, {
      ...existing.data(),
      role: input.role,
      updatedAt: now,
    })
  })
}

export async function listActiveInvitesForClub(
  clubId: string
): Promise<ClubInvite[]> {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Firebase Admin not configured')

  const snap = await adminDb
    .collection('clubInvites')
    .where('clubId', '==', clubId)
    .get()

  const now = Date.now()
  const invites: ClubInvite[] = []
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
    invites.push({
      id: doc.id,
      clubId: data.clubId as string,
      code: data.code as string,
      createdBy: data.createdBy as string,
      createdByRole: data.createdByRole as ClubInviteCreatorRole,
      maxUses: (data.maxUses as number | null) ?? null,
      useCount: (data.useCount as number) ?? 0,
      expiresAt: data.expiresAt?.toDate?.() ?? null,
      revokedAt: null,
      createdAt: data.createdAt?.toDate?.() ?? new Date(),
    })
  }

  invites.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  return invites
}

export async function revokeInvite(input: {
  clubId: string
  inviteId: string
}): Promise<ClubInvite> {
  const adminDb = getAdminDb()
  if (!adminDb) throw new Error('Firebase Admin not configured')

  const ref = adminDb.collection('clubInvites').doc(input.inviteId)

  return adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new Error('Invite not found')

    const data = snap.data()!
    if (data.clubId !== input.clubId) {
      throw new Error('Invite not found')
    }
    if (data.revokedAt) {
      throw new Error('Invite already revoked')
    }

    const revokedAt = Timestamp.now()
    tx.update(ref, { revokedAt })

    return {
      id: snap.id,
      clubId: data.clubId as string,
      code: data.code as string,
      createdBy: data.createdBy as string,
      createdByRole: data.createdByRole as ClubInviteCreatorRole,
      maxUses: (data.maxUses as number | null) ?? null,
      useCount: (data.useCount as number) ?? 0,
      expiresAt: data.expiresAt?.toDate?.() ?? null,
      revokedAt: revokedAt.toDate(),
      createdAt: data.createdAt?.toDate?.() ?? new Date(),
    }
  })
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

/**
 * Public preview for invite links: resolve an active code to the club name.
 * Does not redeem or mutate invite state.
 */
export async function previewInviteByCode(
  code: string
): Promise<{ clubId: string; clubName: string } | null> {
  const invite = await findActiveInviteByCode(code)
  if (!invite) return null
  const club = await getClub(invite.clubId)
  if (!club) return null
  return { clubId: club.id, clubName: club.name }
}

export type RedeemInviteResult =
  | { ok: true; membership: ClubMembership; alreadyMember: boolean; clubId: string }
  | { ok: false; error: string; status: number }

/**
 * Redeem invite by code. Idempotent if already an active member.
 * Membership create + invite useCount update run in a transaction that
 * re-reads revokedAt so a concurrent revoke cannot still grant membership.
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

  try {
    const result = await adminDb.runTransaction(async tx => {
      const inviteRef = adminDb.collection('clubInvites').doc(invite.id)
      const inviteSnap = await tx.get(inviteRef)
      if (!inviteSnap.exists) {
        throw Object.assign(new Error('Invalid or expired invite code'), {
          status: 400,
        })
      }
      const inviteData = inviteSnap.data()!
      if (inviteData.revokedAt) {
        throw Object.assign(new Error('Invalid or expired invite code'), {
          status: 400,
        })
      }
      const nowMs = Date.now()
      if (
        inviteData.expiresAt?.toDate &&
        inviteData.expiresAt.toDate().getTime() < nowMs
      ) {
        throw Object.assign(new Error('Invalid or expired invite code'), {
          status: 400,
        })
      }
      const useCount = (inviteData.useCount as number) ?? 0
      const maxUses = (inviteData.maxUses as number | null) ?? null
      if (typeof maxUses === 'number' && maxUses > 0 && useCount >= maxUses) {
        throw Object.assign(new Error('Invalid or expired invite code'), {
          status: 400,
        })
      }

      const membershipRef = adminDb
        .collection('clubMemberships')
        .doc(existingId)
      const existing = await tx.get(membershipRef)
      if (existing.exists && existing.data()?.status === 'active') {
        return {
          ok: true as const,
          membership: mapMembership(existingId, existing.data()!),
          alreadyMember: true,
          clubId: invite.clubId,
        }
      }

      const now = Timestamp.now()
      const membershipData = {
        clubId: invite.clubId,
        userId: input.userId,
        role: 'player' as const,
        status: 'active' as const,
        joinedAt: existing.exists
          ? (existing.data()?.joinedAt ?? now)
          : now,
        updatedAt: now,
      }
      tx.set(membershipRef, membershipData, { merge: true })
      tx.update(inviteRef, { useCount: useCount + 1 })

      return {
        ok: true as const,
        membership: mapMembership(existingId, membershipData),
        alreadyMember: false,
        clubId: invite.clubId,
      }
    })

    // Set activeClubId if unset (outside tx; best-effort UX preference)
    if (!result.alreadyMember) {
      const userRef = adminDb.collection('users').doc(input.userId)
      const userSnap = await userRef.get()
      if (userSnap.exists && !userSnap.data()?.activeClubId) {
        await userRef.update({
          activeClubId: invite.clubId,
          updatedAt: Timestamp.now(),
        })
      }
    }

    return result
  } catch (err: unknown) {
    const status =
      err && typeof err === 'object' && 'status' in err
        ? Number((err as { status: number }).status)
        : undefined
    if (status === 400) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Invalid or expired invite code',
        status: 400,
      }
    }
    throw err
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
