import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  generateInviteCode,
  membershipDocId,
  slugifyClubName,
} from '@/lib/services/clubService'
import { normalizeUserRole } from '@/types/user'

vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: vi.fn(),
  getAdminAuth: vi.fn(),
}))

describe('club helpers', () => {
  it('slugifyClubName produces URL-safe slugs', () => {
    expect(slugifyClubName('Jax State Soccer Club')).toBe(
      'jax-state-soccer-club'
    )
    expect(slugifyClubName('  Hello World  ')).toBe('hello-world')
    expect(slugifyClubName('!!!')).toBe('')
  })

  it('membershipDocId is deterministic', () => {
    expect(membershipDocId('club1', 'user1')).toBe('club1_user1')
  })

  it('generateInviteCode returns uppercase alphanumeric of expected length', () => {
    const code = generateInviteCode(6)
    expect(code).toHaveLength(6)
    expect(code).toMatch(/^[A-Z0-9]+$/)
  })
})

describe('normalizeUserRole', () => {
  it('maps legacy admin to super_user', () => {
    expect(normalizeUserRole('admin')).toBe('super_user')
    expect(normalizeUserRole('super_user')).toBe('super_user')
    expect(normalizeUserRole('user')).toBe('user')
    expect(normalizeUserRole(undefined)).toBe('user')
  })
})

describe('auth club helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('verifySuperUser returns false for regular user', async () => {
    const { getAdminAuth, getAdminDb } = await import('@/lib/firebase/admin')
    vi.mocked(getAdminAuth).mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue({ uid: 'u1', email: 'a@b.c' }),
    } as never)

    const get = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ role: 'user' }),
    })
    vi.mocked(getAdminDb).mockReturnValue({
      collection: () => ({ doc: () => ({ get }) }),
    } as never)

    const { verifySuperUser } = await import('@/lib/api/auth')
    const result = await verifySuperUser(
      new Request('http://localhost', {
        headers: { authorization: 'Bearer tok' },
      })
    )
    expect(result.uid).toBe('u1')
    expect(result.isSuperUser).toBe(false)
  })

  it('verifySuperUser accepts legacy admin role', async () => {
    const { getAdminAuth, getAdminDb } = await import('@/lib/firebase/admin')
    vi.mocked(getAdminAuth).mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue({ uid: 'u1', email: 'a@b.c' }),
    } as never)

    const get = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ role: 'admin' }),
    })
    vi.mocked(getAdminDb).mockReturnValue({
      collection: () => ({ doc: () => ({ get }) }),
    } as never)

    const { verifySuperUser } = await import('@/lib/api/auth')
    const result = await verifySuperUser(
      new Request('http://localhost', {
        headers: { authorization: 'Bearer tok' },
      })
    )
    expect(result.isSuperUser).toBe(true)
  })

  function mockAuthDb(opts: {
    role?: string
    membershipRole?: 'player' | 'club_admin' | null
    allowPlayerInvites?: boolean
  }) {
    const {
      role = 'user',
      membershipRole = null,
      allowPlayerInvites = false,
    } = opts
    const userGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ role }),
    })
    const membershipGet = vi.fn().mockResolvedValue(
      membershipRole
        ? {
            empty: false,
            docs: [
              {
                id: 'c1_u1',
                data: () => ({
                  clubId: 'c1',
                  userId: 'u1',
                  role: membershipRole,
                  status: 'active',
                  joinedAt: { toDate: () => new Date() },
                  updatedAt: { toDate: () => new Date() },
                }),
              },
            ],
          }
        : { empty: true, docs: [] }
    )
    const clubGet = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ settings: { allowPlayerInvites } }),
    })

    return { userGet, membershipGet, clubGet }
  }

  async function installAuthMocks(opts: {
    role?: string
    membershipRole?: 'player' | 'club_admin' | null
    allowPlayerInvites?: boolean
  }) {
    const { getAdminAuth, getAdminDb } = await import('@/lib/firebase/admin')
    vi.mocked(getAdminAuth).mockReturnValue({
      verifyIdToken: vi.fn().mockResolvedValue({ uid: 'u1', email: 'a@b.c' }),
    } as never)

    const { userGet, membershipGet, clubGet } = mockAuthDb(opts)
    vi.mocked(getAdminDb).mockReturnValue({
      collection: (name: string) => {
        if (name === 'users') return { doc: () => ({ get: userGet }) }
        if (name === 'clubs') return { doc: () => ({ get: clubGet }) }
        if (name === 'clubMemberships') {
          return {
            where: () => ({
              where: () => ({
                where: () => ({
                  limit: () => ({ get: membershipGet }),
                }),
              }),
            }),
          }
        }
        return { doc: () => ({ get: vi.fn() }) }
      },
    } as never)
  }

  it('verifyClubAdmin allows club_admin membership', async () => {
    await installAuthMocks({ membershipRole: 'club_admin' })

    const { verifyClubAdmin } = await import('@/lib/api/auth')
    const result = await verifyClubAdmin(
      new Request('http://localhost', {
        headers: { authorization: 'Bearer tok' },
      }),
      'c1'
    )
    expect(result.isClubAdmin).toBe(true)
    expect(result.isSuperUser).toBe(false)
  })

  it('verifyClubAdmin rejects player membership', async () => {
    await installAuthMocks({ membershipRole: 'player' })

    const { verifyClubAdmin } = await import('@/lib/api/auth')
    const result = await verifyClubAdmin(
      new Request('http://localhost', {
        headers: { authorization: 'Bearer tok' },
      }),
      'c1'
    )
    expect(result.uid).toBe('u1')
    expect(result.isClubAdmin).toBe(false)
    expect(result.isSuperUser).toBe(false)
  })

  it('verifyCanCreateInvite blocks players when allowPlayerInvites is false', async () => {
    await installAuthMocks({
      membershipRole: 'player',
      allowPlayerInvites: false,
    })

    const { verifyCanCreateInvite } = await import('@/lib/api/auth')
    const result = await verifyCanCreateInvite(
      new Request('http://localhost', {
        headers: { authorization: 'Bearer tok' },
      }),
      'c1'
    )
    expect(result.allowed).toBe(false)
  })

  it('verifyCanCreateInvite allows players when allowPlayerInvites is true', async () => {
    await installAuthMocks({
      membershipRole: 'player',
      allowPlayerInvites: true,
    })

    const { verifyCanCreateInvite } = await import('@/lib/api/auth')
    const result = await verifyCanCreateInvite(
      new Request('http://localhost', {
        headers: { authorization: 'Bearer tok' },
      }),
      'c1'
    )
    expect(result.allowed).toBe(true)
    expect(result.createdByRole).toBe('player')
  })
})
