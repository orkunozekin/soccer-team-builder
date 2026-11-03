import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getClubMemberProfile } from './clubMemberProfile'

const store = vi.hoisted(() => new Map<string, Record<string, unknown>>())

const ts = (iso: string) => ({ toDate: () => new Date(iso) })

function snapshot(path: string) {
  const data = store.get(path)
  return {
    id: path.split('/')[1],
    exists: Boolean(data),
    data: () => data,
  }
}

vi.mock('@/lib/firebase/admin', () => ({
  getAdminDb: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        path: `${name}/${id}`,
        get: async () => snapshot(`${name}/${id}`),
      }),
      where: (field: string, _op: string, value: unknown) => ({
        get: async () => ({
          docs: Array.from(store.keys())
            .filter(key => key.startsWith(`${name}/`))
            .map(snapshot)
            .filter(doc => doc.data()?.[field] === value),
        }),
      }),
    }),
    getAll: async (...refs: { path: string }[]) =>
      refs.map(ref => snapshot(ref.path)),
  }),
}))

describe('getClubMemberProfile', () => {
  beforeEach(() => {
    store.clear()
    store.set('clubMemberships/c1_u2', {
      clubId: 'c1',
      userId: 'u2',
      role: 'player',
      status: 'active',
      joinedAt: ts('2026-01-05T00:00:00Z'),
    })
    store.set('users/u2', {
      displayName: 'Sam',
      email: 'sam@example.com',
      jerseyNumber: 9,
      position: 'ST',
    })
    store.set('matches/m-own', {
      clubId: 'c1',
      date: ts('2026-02-01T00:00:00Z'),
      time: '19:00',
    })
    store.set('matches/m-other', {
      clubId: 'c2',
      date: ts('2026-02-02T00:00:00Z'),
      time: '20:00',
    })
    for (const matchId of ['m-own', 'm-other']) {
      store.set(`rsvps/r-${matchId}`, {
        matchId,
        userId: 'u2',
        status: 'confirmed',
        attended: true,
        rsvpAt: ts('2026-01-31T00:00:00Z'),
        updatedAt: ts('2026-01-31T00:00:00Z'),
      })
    }
  })

  it("returns only this club's matches and RSVPs", async () => {
    const profile = await getClubMemberProfile('c1', 'u2')
    expect(profile?.member).toMatchObject({
      displayName: 'Sam',
      clubRole: 'player',
      joinedAt: '2026-01-05T00:00:00.000Z',
    })
    expect(profile?.matches.map(m => m.id)).toEqual(['m-own'])
    expect(profile?.rsvps.map(r => r.matchId)).toEqual(['m-own'])
  })

  it('returns null for users who are not active members', async () => {
    expect(await getClubMemberProfile('c2', 'u2')).toBeNull()
    store.set('clubMemberships/c1_u2', {
      ...store.get('clubMemberships/c1_u2'),
      status: 'removed',
    })
    expect(await getClubMemberProfile('c1', 'u2')).toBeNull()
  })
})
