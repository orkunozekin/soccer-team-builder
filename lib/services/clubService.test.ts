import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const store = new Map<string, Record<string, unknown>>()
  return { store }
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

  it('redeemInvite fails when invite is revoked before membership write', async () => {
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

    const { redeemInvite } = await import('@/lib/services/clubService')

    // Simulate revoke after findActiveInviteByCode would have succeeded:
    // mark revoked before redeem's transaction re-reads the invite.
    mocks.store.set('clubInvites/inv1', {
      ...mocks.store.get('clubInvites/inv1')!,
      revokedAt: now,
    })

    const result = await redeemInvite({ code: 'ABCD12', userId: 'u2' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(400)
    }
    expect(mocks.store.get('clubMemberships/c1_u2')).toBeUndefined()
  })
})
