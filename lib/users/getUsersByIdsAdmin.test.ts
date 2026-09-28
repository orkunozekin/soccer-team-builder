import { describe, expect, it, vi } from 'vitest'
import { getUsersByIdsAdmin } from './getUsersByIdsAdmin'

describe('getUsersByIdsAdmin', () => {
  it('loads only requested user docs via getAll', async () => {
    const getAll = vi.fn(async (...refs: Array<{ id: string }>) =>
      refs.map(ref => ({
        id: ref.id,
        exists: ref.id !== 'missing',
        data: () =>
          ref.id === 'missing'
            ? undefined
            : {
                uid: ref.id,
                email: `${ref.id}@example.com`,
                displayName: ref.id,
                jerseyNumber: null,
                position: 'ST',
                role: 'user',
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-01'),
              },
      }))
    )
    const adminDb = {
      collection: () => ({
        doc: (id: string) => ({ id }),
      }),
      getAll,
    }

    const users = await getUsersByIdsAdmin(adminDb as never, [
      'u1',
      'u1',
      'missing',
      'u2',
      '',
    ])

    expect(getAll).toHaveBeenCalledTimes(1)
    expect(users.map(u => u.uid).sort()).toEqual(['u1', 'u2'])
  })

  it('returns an empty list without calling getAll', async () => {
    const getAll = vi.fn()
    const adminDb = {
      collection: () => ({ doc: (id: string) => ({ id }) }),
      getAll,
    }
    await expect(getUsersByIdsAdmin(adminDb as never, [])).resolves.toEqual([])
    expect(getAll).not.toHaveBeenCalled()
  })
})
