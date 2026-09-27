import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryDocumentsMock = vi.fn()

vi.mock('@/lib/firebase/firestore', () => ({
  queryDocuments: (...args: unknown[]) => queryDocumentsMock(...args),
  getDocument: vi.fn(),
  updateDocument: vi.fn(),
  dateToTimestamp: (d: Date) => d,
  timestampToDate: (d: unknown) => (d instanceof Date ? d : null),
}))

import {
  getMatchesForClub,
  listMatchesForViewer,
} from './matchService'

function matchDoc(
  id: string,
  clubId: string | null,
  hoursFromNow = 24
): Record<string, unknown> {
  return {
    id,
    clubId,
    date: new Date(Date.now() + hoursFromNow * 60 * 60 * 1000),
    time: '19:00',
    location: null,
    rsvpOpen: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('listMatchesForViewer / getMatchesForClub', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses an unqualified query for super users with no club filter', async () => {
    queryDocumentsMock.mockResolvedValueOnce([matchDoc('m1', 'c1')])

    const result = await listMatchesForViewer({
      clubId: null,
      isSuperUser: true,
    })

    expect(queryDocumentsMock).toHaveBeenCalledTimes(1)
    expect(queryDocumentsMock.mock.calls[0][0]).toBe('matches')
    expect(result.map(m => m.id)).toEqual(['m1'])
  })

  it('queries only by clubId for a club-scoped list (no orderBy)', async () => {
    // Return unsorted so we prove finalizeMatchList sorts in memory.
    queryDocumentsMock.mockResolvedValueOnce([
      matchDoc('m-later', 'club-a', 48),
      matchDoc('m-sooner', 'club-a', 12),
    ])

    const result = await getMatchesForClub('club-a')

    expect(queryDocumentsMock).toHaveBeenCalledTimes(1)
    expect(queryDocumentsMock.mock.calls[0][0]).toBe('matches')
    // Single equality constraint — composite index not required.
    expect(queryDocumentsMock.mock.calls[0][1]).toHaveLength(1)
    expect(result.map(m => m.id)).toEqual(['m-sooner', 'm-later'])
  })

  it('returns no matches for members without a club context', async () => {
    const result = await listMatchesForViewer({
      clubId: null,
      isSuperUser: false,
    })

    expect(queryDocumentsMock).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })

  it('listMatchesForViewer scopes non-super users to the club query', async () => {
    queryDocumentsMock.mockResolvedValueOnce([matchDoc('m-a', 'club-a')])

    await listMatchesForViewer({
      clubId: 'club-a',
      isSuperUser: false,
    })

    expect(queryDocumentsMock).toHaveBeenCalledTimes(1)
  })
})
