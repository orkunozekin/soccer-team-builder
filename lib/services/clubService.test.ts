import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const store = new Map<string, Record<string, unknown>>()
  /** Optional hook fired at the start of runTransaction (after prior reads). */
  let beforeTransaction: (() => void) | null = null
  return {
    store,
    get beforeTransaction() {
      return beforeTransaction
    },
    set beforeTransaction(fn: (() => void) | null) {
      beforeTransaction = fn
    },
  }
})

function docsForCollection(name: string) {
  return Array.from(mocks.store.entries())
    .filter(([k]) => k.startsWith(`${name}/`))
    .map(([k, data]) => {
      const id = k.slice(name.length + 1)
      return {
        id,
        data: () => data,
        ref: {
          update: async (patch: Record<string, unknown>) => {
            const cur = mocks.store.get(k) ?? {}
            mocks.store.set(k, { ...cur, ...patch })
          },
        },
      }
    })
}

function makeQuery(name: string, filters: Array<[string, string, unknown]> = []) {
  const query = {
    where: (field: string, op: string, value: unknown) =>
      makeQuery(name, [...filters, [field, op, value]]),
    limit: (_n: number) => ({
      get: async () => {
        const result = await query.get()
        return {
          ...result,
          docs: result.docs.slice(0, _n),
          size: Math.min(result.size, _n),
          empty: Math.min(result.size, _n) === 0,
        }
      },
    }),
    get: async () => {
      let docs = docsForCollection(name)
      for (const [field, op, value] of filters) {
        if (op !== '==') continue
        docs = docs.filter(d => d.data()?.[field] === value)
      }
      return { docs, size: docs.length, empty: docs.length === 0 }
    },
  }
  return query
}

vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: () => {
    const db = {
      getAll: async (
        ...refs: Array<{ _path?: string; id: string }>
      ) => {
        return refs.map(ref => {
          const path = ref._path ?? `users/${ref.id}`
          const data = mocks.store.get(path)
          return {
            exists: Boolean(data),
            id: ref.id,
            data: () => data,
          }
        })
      },
      collection: (name: string) => ({
        doc: (id?: string) => {
          const docId = id ?? `auto_${mocks.store.size}`
          const path = `${name}/${docId}`
          return {
            id: docId,
            _path: path,
            get: async () => {
              const data = mocks.store.get(path)
              return {
                exists: Boolean(data),
                id: docId,
                data: () => data,
                ref: {
                  update: async (patch: Record<string, unknown>) => {
                    const cur = mocks.store.get(path) ?? {}
                    mocks.store.set(path, { ...cur, ...patch })
                  },
                },
              }
            },
            set: async (
              data: Record<string, unknown>,
              opts?: { merge?: boolean }
            ) => {
              if (opts?.merge) {
                const cur = mocks.store.get(path) ?? {}
                mocks.store.set(path, { ...cur, ...data })
              } else {
                mocks.store.set(path, { ...data })
              }
            },
            update: async (patch: Record<string, unknown>) => {
              const cur = mocks.store.get(path) ?? {}
              mocks.store.set(path, { ...cur, ...patch })
            },
          }
        },
        where: (field: string, op: string, value: unknown) =>
          makeQuery(name, [[field, op, value]]),
        limit: (n: number) => makeQuery(name).limit(n),
        get: async () => {
          const docs = docsForCollection(name)
          return { docs, size: docs.length, empty: docs.length === 0 }
        },
      }),
      runTransaction: async <T>(
        fn: (tx: {
          get: (target: {
            get?: () => Promise<unknown>
            _path?: string
          }) => Promise<unknown>
          update: (
            ref: { update: (patch: Record<string, unknown>) => Promise<void> },
            patch: Record<string, unknown>
          ) => void
          set: (
            ref: {
              set: (
                data: Record<string, unknown>,
                opts?: { merge?: boolean }
              ) => Promise<void>
            },
            data: Record<string, unknown>,
            opts?: { merge?: boolean }
          ) => void
        }) => Promise<T>
      ): Promise<T> => {
        mocks.beforeTransaction?.()
        const pending: Array<() => Promise<void>> = []
        const tx = {
          get: async (target: {
            get?: () => Promise<unknown>
          }) => {
            if (typeof target.get === 'function') {
              return target.get()
            }
            throw new Error('Unsupported transaction get target')
          },
          update: (
            ref: { update: (patch: Record<string, unknown>) => Promise<void> },
            patch: Record<string, unknown>
          ) => {
            pending.push(() => ref.update(patch))
          },
          set: (
            ref: {
              set: (
                data: Record<string, unknown>,
                opts?: { merge?: boolean }
              ) => Promise<void>
            },
            data: Record<string, unknown>,
            opts?: { merge?: boolean }
          ) => {
            pending.push(() => ref.set(data, opts))
          },
        }
        const result = await fn(tx)
        for (const op of pending) {
          await op()
        }
        return result
      },
    }
    return db
  },
}))

describe('clubService redeem + backfill', () => {
  beforeEach(() => {
    mocks.store.clear()
    mocks.beforeTransaction = null
    vi.resetModules()
  })

  it('redeemInvite is idempotent for existing members', async () => {
    const { Timestamp } = await import('firebase-admin/firestore')
    const now = Timestamp.now()

    mocks.store.set('clubs/c1', {
      name: 'Test Club',
      slug: 'test',
      createdBy: 'admin1',
      settings: { allowPlayerInvites: false },
      createdAt: now,
      updatedAt: now,
    })
    mocks.store.set('clubMemberships/c1_u1', {
      clubId: 'c1',
      userId: 'u1',
      role: 'player',
      status: 'active',
      joinedAt: now,
      updatedAt: now,
    })

    const { upsertMembership, membershipDocId } = await import(
      '@/lib/services/clubService'
    )

    const first = await upsertMembership({
      clubId: 'c1',
      userId: 'u1',
      role: 'player',
    })
    expect(first.created).toBe(false)
    expect(first.membership.id).toBe(membershipDocId('c1', 'u1'))

    const second = await upsertMembership({
      clubId: 'c1',
      userId: 'u1',
      role: 'player',
    })
    expect(second.created).toBe(false)
  })

  it('backfillClubMemberships promotes admin and stamps clubId', async () => {
    const { Timestamp } = await import('firebase-admin/firestore')
    const now = Timestamp.now()

    mocks.store.set('clubs/c1', {
      name: 'Soccerville',
      slug: 'soccerville',
      createdBy: 'a1',
      settings: { allowPlayerInvites: false },
      createdAt: now,
      updatedAt: now,
    })
    mocks.store.set('users/a1', {
      role: 'admin',
      email: 'a@test.com',
      displayName: 'Admin',
    })
    mocks.store.set('users/p1', {
      role: 'user',
      email: 'p@test.com',
      displayName: 'Player',
    })
    mocks.store.set('matches/m1', {
      time: '09:00',
      createdAt: now,
      updatedAt: now,
    })
    mocks.store.set('schedules/s1', {
      name: 'Weekly',
      createdAt: now,
      updatedAt: now,
    })
    mocks.store.set('savedLocations/l1', {
      name: 'Park',
      createdAt: now,
      updatedAt: now,
    })

    const { backfillClubMemberships } = await import(
      '@/lib/services/clubService'
    )
    const result = await backfillClubMemberships('c1')

    expect(result.usersProcessed).toBe(2)
    expect(result.membershipsCreated).toBe(2)
    expect(result.rolesPromotedToSuperUser).toBe(1)
    expect(result.matchesUpdated).toBe(1)
    expect(result.schedulesUpdated).toBe(1)
    expect(result.locationsUpdated).toBe(1)

    expect(mocks.store.get('users/a1')?.role).toBe('super_user')
    expect(mocks.store.get('clubMemberships/c1_a1')?.role).toBe('club_admin')
    expect(mocks.store.get('clubMemberships/c1_p1')?.role).toBe('player')
    expect(mocks.store.get('matches/m1')?.clubId).toBe('c1')

    const second = await backfillClubMemberships('c1')
    expect(second.membershipsCreated).toBe(0)
    expect(second.membershipsUpdated).toBe(2)
    expect(second.rolesPromotedToSuperUser).toBe(0)
    expect(second.matchesUpdated).toBe(0)
  })

  it('ensureClubNameLower sets missing nameLower idempotently', async () => {
    const { Timestamp } = await import('firebase-admin/firestore')
    const now = Timestamp.now()
    mocks.store.set('clubs/c1', {
      name: 'Jax State Soccer Club',
      slug: 'jax-state-soccer-club',
      createdBy: 'a1',
      settings: { allowPlayerInvites: false },
      createdAt: now,
      updatedAt: now,
    })

    const { ensureClubNameLower } = await import('@/lib/services/clubService')
    expect(await ensureClubNameLower('c1')).toBe(true)
    expect(mocks.store.get('clubs/c1')?.nameLower).toBe(
      'jax state soccer club'
    )
    expect(await ensureClubNameLower('c1')).toBe(false)
  })

  it('previewInviteByCode returns club name for an active invite', async () => {
    const { Timestamp } = await import('firebase-admin/firestore')
    const now = Timestamp.now()
    mocks.store.set('clubs/c1', {
      name: 'Jax State Soccer Club',
      slug: 'jax-state-soccer-club',
      createdBy: 'a1',
      settings: { allowPlayerInvites: false },
      createdAt: now,
      updatedAt: now,
    })
    mocks.store.set('clubInvites/inv1', {
      clubId: 'c1',
      code: 'ABCD12',
      createdBy: 'a1',
      createdByRole: 'club_admin',
      maxUses: null,
      useCount: 0,
      expiresAt: null,
      revokedAt: null,
      createdAt: now,
    })

    const { previewInviteByCode } = await import('@/lib/services/clubService')
    await expect(previewInviteByCode('abcd12')).resolves.toEqual({
      clubId: 'c1',
      clubName: 'Jax State Soccer Club',
    })
    await expect(previewInviteByCode('NOPE')).resolves.toBeNull()
  })

  it('listMembershipsForClub batch-loads display names', async () => {
    const { Timestamp } = await import('firebase-admin/firestore')
    const now = Timestamp.now()
    mocks.store.set('clubMemberships/c1_p1', {
      clubId: 'c1',
      userId: 'p1',
      role: 'player',
      status: 'active',
      joinedAt: now,
      updatedAt: now,
    })
    mocks.store.set('clubMemberships/c1_a1', {
      clubId: 'c1',
      userId: 'a1',
      role: 'club_admin',
      status: 'active',
      joinedAt: now,
      updatedAt: now,
    })
    mocks.store.set('users/p1', {
      displayName: 'Pat Player',
      email: 'pat@example.com',
    })
    mocks.store.set('users/a1', {
      displayName: 'Alex Admin',
      email: 'alex@example.com',
    })

    const { listMembershipsForClub } = await import(
      '@/lib/services/clubService'
    )
    const members = await listMembershipsForClub('c1')
    expect(members.map(m => m.displayName)).toEqual([
      'Alex Admin',
      'Pat Player',
    ])
    expect(members[0].role).toBe('club_admin')
    expect(members[1].email).toBe('pat@example.com')
  })

  it('updateMembershipRole blocks demoting the last club admin', async () => {
    const { Timestamp } = await import('firebase-admin/firestore')
    const now = Timestamp.now()
    mocks.store.set('clubMemberships/c1_a1', {
      clubId: 'c1',
      userId: 'a1',
      role: 'club_admin',
      status: 'active',
      joinedAt: now,
      updatedAt: now,
    })
    mocks.store.set('clubMemberships/c1_p1', {
      clubId: 'c1',
      userId: 'p1',
      role: 'player',
      status: 'active',
      joinedAt: now,
      updatedAt: now,
    })

    const { updateMembershipRole } = await import('@/lib/services/clubService')

    await expect(
      updateMembershipRole({ clubId: 'c1', userId: 'a1', role: 'player' })
    ).rejects.toThrow('Cannot demote the last club admin')

    // Promote player first, then demote is allowed
    await updateMembershipRole({
      clubId: 'c1',
      userId: 'p1',
      role: 'club_admin',
    })
    expect(mocks.store.get('clubMemberships/c1_p1')?.role).toBe('club_admin')

    await updateMembershipRole({
      clubId: 'c1',
      userId: 'a1',
      role: 'player',
    })
    expect(mocks.store.get('clubMemberships/c1_a1')?.role).toBe('player')
  })

  it('revokeInvite sets revokedAt and rejects second revoke', async () => {
    const { Timestamp } = await import('firebase-admin/firestore')
    const now = Timestamp.now()
    mocks.store.set('clubInvites/inv1', {
      clubId: 'c1',
      code: 'ABCD12',
      createdBy: 'a1',
      createdByRole: 'club_admin',
      maxUses: null,
      useCount: 0,
      expiresAt: null,
      revokedAt: null,
      createdAt: now,
    })

    const { revokeInvite } = await import('@/lib/services/clubService')
    const first = await revokeInvite({ clubId: 'c1', inviteId: 'inv1' })
    expect(first.revokedAt).toBeInstanceOf(Date)
    expect(mocks.store.get('clubInvites/inv1')?.revokedAt).toBeTruthy()

    await expect(
      revokeInvite({ clubId: 'c1', inviteId: 'inv1' })
    ).rejects.toThrow('Invite already revoked')
  })

  it('redeemInvite fails when invite is revoked after lookup but before tx write', async () => {
    const { Timestamp } = await import('firebase-admin/firestore')
    const now = Timestamp.now()
    mocks.store.set('clubs/c1', {
      name: 'Test Club',
      slug: 'test',
      createdBy: 'a1',
      settings: { allowPlayerInvites: false },
      createdAt: now,
      updatedAt: now,
    })
    mocks.store.set('clubInvites/inv1', {
      clubId: 'c1',
      code: 'ABCD12',
      createdBy: 'a1',
      createdByRole: 'club_admin',
      maxUses: null,
      useCount: 0,
      expiresAt: null,
      revokedAt: null,
      createdAt: now,
    })
    mocks.store.set('users/u2', {
      role: 'user',
      email: 'u2@test.com',
      displayName: 'User Two',
    })

    // Invite stays active for findActiveInviteByCode; revoke runs when the
    // redeem transaction starts so the in-tx re-read sees revokedAt.
    mocks.beforeTransaction = () => {
      mocks.store.set('clubInvites/inv1', {
        ...mocks.store.get('clubInvites/inv1')!,
        revokedAt: now,
      })
    }

    const { redeemInvite } = await import('@/lib/services/clubService')
    const result = await redeemInvite({ code: 'ABCD12', userId: 'u2' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(400)
      expect(result.error).toMatch(/invalid or expired invite code/i)
    }
    expect(mocks.store.get('clubMemberships/c1_u2')).toBeUndefined()
    expect(mocks.store.get('clubInvites/inv1')?.useCount).toBe(0)
  })
})

describe('createInvite expiry + player quota', () => {
  const HOUR = 60 * 60 * 1000

  beforeEach(() => {
    mocks.store.clear()
    mocks.beforeTransaction = null
    vi.resetModules()
  })

  it('sets a 12h expiry and skips the quota for club admins', async () => {
    const { createInvite } = await import('@/lib/services/clubService')

    const first = await createInvite({
      clubId: 'c1',
      createdBy: 'a1',
      createdByRole: 'club_admin',
    })
    await createInvite({
      clubId: 'c1',
      createdBy: 'a1',
      createdByRole: 'club_admin',
    })

    expect(first.expiresAt!.getTime() - first.createdAt.getTime()).toBe(
      12 * HOUR
    )
    const stored = mocks.store.get(`clubInvites/${first.id}`)
    expect(
      (stored?.expiresAt as { toMillis: () => number }).toMillis()
    ).toBe(first.expiresAt!.getTime())
    expect(mocks.store.get('clubInviteQuotas/c1_a1')).toBeUndefined()
  })

  it('limits a player to one invite per club inside the cooldown', async () => {
    const { createInvite, InviteQuotaExceededError } = await import(
      '@/lib/services/clubService'
    )

    const first = await createInvite({
      clubId: 'c1',
      createdBy: 'p1',
      createdByRole: 'player',
    })
    expect(mocks.store.get('clubInviteQuotas/c1_p1')?.lastInviteId).toBe(
      first.id
    )

    const second = createInvite({
      clubId: 'c1',
      createdBy: 'p1',
      createdByRole: 'player',
    })
    await expect(second).rejects.toBeInstanceOf(InviteQuotaExceededError)
    await second.catch((err: InstanceType<typeof InviteQuotaExceededError>) => {
      expect(err.nextAllowedAt.getTime()).toBe(
        first.createdAt.getTime() + 11 * HOUR
      )
    })

    await expect(
      createInvite({ clubId: 'c2', createdBy: 'p1', createdByRole: 'player' })
    ).resolves.toMatchObject({ clubId: 'c2' })
  })

  it('frees the slot when the player invite is revoked', async () => {
    const { createInvite, revokeInvite } = await import(
      '@/lib/services/clubService'
    )

    const first = await createInvite({
      clubId: 'c1',
      createdBy: 'p1',
      createdByRole: 'player',
    })
    await revokeInvite({ clubId: 'c1', inviteId: first.id })

    const second = await createInvite({
      clubId: 'c1',
      createdBy: 'p1',
      createdByRole: 'player',
    })
    expect(second.id).not.toBe(first.id)
    expect(mocks.store.get('clubInviteQuotas/c1_p1')?.lastInviteId).toBe(
      second.id
    )
  })

  it('markInviteExpired marks a due invite once and ignores early or revoked ones', async () => {
    const { Timestamp } = await import('firebase-admin/firestore')
    const base = {
      clubId: 'c1',
      createdBy: 'a1',
      createdByRole: 'club_admin',
      expiredAt: null,
      revokedAt: null,
    }
    mocks.store.set('clubInvites/due', {
      ...base,
      code: 'DUE111',
      expiresAt: Timestamp.fromMillis(Date.now() - 1000),
    })
    mocks.store.set('clubInvites/early', {
      ...base,
      code: 'EARLY1',
      expiresAt: Timestamp.fromMillis(Date.now() + HOUR),
    })
    mocks.store.set('clubInvites/revoked', {
      ...base,
      code: 'REV111',
      expiresAt: Timestamp.fromMillis(Date.now() - 1000),
      revokedAt: Timestamp.now(),
    })
    mocks.store.set('clubInvites/legacy', {
      ...base,
      code: 'LEG111',
      expiresAt: null,
    })

    const { markInviteExpired } = await import('@/lib/services/clubService')

    await expect(markInviteExpired('due')).resolves.toEqual({
      changed: true,
      clubId: 'c1',
      code: 'DUE111',
    })
    expect(mocks.store.get('clubInvites/due')?.expiredAt).toBeTruthy()
    await expect(markInviteExpired('due')).resolves.toEqual({
      changed: false,
    })

    for (const id of ['early', 'revoked', 'legacy', 'missing']) {
      await expect(markInviteExpired(id)).resolves.toEqual({ changed: false })
    }
    expect(mocks.store.get('clubInvites/early')?.expiredAt).toBeNull()
  })

  it('allows a player again once the cooldown has elapsed', async () => {
    const { Timestamp } = await import('firebase-admin/firestore')
    mocks.store.set('clubInvites/old', {
      clubId: 'c1',
      code: 'OLD111',
      createdBy: 'p1',
      createdByRole: 'player',
      revokedAt: null,
    })
    mocks.store.set('clubInviteQuotas/c1_p1', {
      clubId: 'c1',
      userId: 'p1',
      lastInviteId: 'old',
      lastCreatedAt: Timestamp.fromMillis(Date.now() - 11 * HOUR - 1000),
    })

    const { createInvite } = await import('@/lib/services/clubService')
    const invite = await createInvite({
      clubId: 'c1',
      createdBy: 'p1',
      createdByRole: 'player',
    })
    expect(mocks.store.get('clubInviteQuotas/c1_p1')?.lastInviteId).toBe(
      invite.id
    )
  })
})
