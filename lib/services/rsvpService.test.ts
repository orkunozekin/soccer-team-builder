import { describe, expect, it, vi } from 'vitest'
import {
  cancelRSVP,
  createRSVP,
  deleteRSVP,
  getMatchRSVPs,
  getMatchRsvpCount,
  getRSVP,
  getUserRSVP,
} from './rsvpService'

const mocks = vi.hoisted(() => {
  const createDocumentMock = vi.fn()
  const getDocumentMock = vi.fn()
  const updateDocumentMock = vi.fn()
  const deleteDocumentMock = vi.fn()
  const queryDocumentsMock = vi.fn()
  const timestampToDateMock = vi.fn(value =>
    value instanceof Date ? value : new Date()
  )

  return {
    createDocumentMock,
    getDocumentMock,
    updateDocumentMock,
    deleteDocumentMock,
    queryDocumentsMock,
    timestampToDateMock,
  }
})

vi.mock('@/lib/firebase/firestore', () => ({
  createDocument: mocks.createDocumentMock,
  getDocument: mocks.getDocumentMock,
  updateDocument: mocks.updateDocumentMock,
  deleteDocument: mocks.deleteDocumentMock,
  queryDocuments: mocks.queryDocumentsMock,
  timestampToDate: mocks.timestampToDateMock,
}))

vi.mock('firebase/firestore', () => ({
  where: (...args: unknown[]) => ({ where: args }),
}))

describe('rsvpService', () => {
  it('createRSVP writes a confirmed RSVP with a generated id', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)

    const id = await createRSVP('match1', 'user1')

    expect(id).toBe('rsvp_match1_user1_1700000000000')
    expect(mocks.createDocumentMock).toHaveBeenCalledWith('rsvps', id, {
      matchId: 'match1',
      userId: 'user1',
      status: 'confirmed',
    })
  })

  it('getRSVP returns null when document is missing', async () => {
    mocks.getDocumentMock.mockResolvedValueOnce(null)
    const result = await getRSVP('missing')
    expect(result).toBeNull()
  })

  it('getRSVP maps firestore data to RSVP model', async () => {
    const now = new Date()
    mocks.getDocumentMock.mockResolvedValueOnce({
      matchId: 'match1',
      userId: 'user1',
      status: 'confirmed',
      position: 'ST',
      rsvpAt: now,
      updatedAt: now,
    })

    const result = await getRSVP('r1')

    expect(result).not.toBeNull()
    expect(result).toMatchObject({
      id: 'r1',
      matchId: 'match1',
      userId: 'user1',
      status: 'confirmed',
      position: 'ST',
    })
  })

  it('getUserRSVP returns first confirmed RSVP or null', async () => {
    mocks.queryDocumentsMock.mockResolvedValueOnce([])
    const none = await getUserRSVP('match1', 'user1')
    expect(none).toBeNull()

    const now = new Date()
    mocks.queryDocumentsMock.mockResolvedValueOnce([
      {
        id: 'r1',
        matchId: 'match1',
        userId: 'user1',
        status: 'confirmed',
        position: 'ST',
        rsvpAt: now,
        updatedAt: now,
      },
    ])

    const some = await getUserRSVP('match1', 'user1')
    expect(some).not.toBeNull()
    expect(some).toMatchObject({
      id: 'r1',
      matchId: 'match1',
      userId: 'user1',
      status: 'confirmed',
      position: 'ST',
    })
  })

  it('getMatchRSVPs maps all confirmed RSVPs', async () => {
    const now = new Date()
    mocks.queryDocumentsMock.mockResolvedValueOnce([
      {
        id: 'r1',
        matchId: 'match1',
        userId: 'user1',
        status: 'confirmed',
        position: 'ST',
        rsvpAt: now,
        updatedAt: now,
      },
      {
        id: 'r2',
        matchId: 'match1',
        userId: 'user2',
        status: 'confirmed',
        position: null,
        rsvpAt: now,
        updatedAt: now,
      },
    ])

    const result = await getMatchRSVPs('match1')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('r1')
    expect(result[1].id).toBe('r2')
  })

  it('getMatchRsvpCount returns number of confirmed RSVPs', async () => {
    mocks.queryDocumentsMock.mockResolvedValueOnce([{}, {}, {}])
    const count = await getMatchRsvpCount('match1')
    expect(count).toBe(3)
  })

  it('cancelRSVP updates status to cancelled', async () => {
    await cancelRSVP('r1')
    expect(mocks.updateDocumentMock).toHaveBeenCalledWith('rsvps', 'r1', {
      status: 'cancelled',
    })
  })

  it('deleteRSVP deletes the document', async () => {
    await deleteRSVP('r1')
    expect(mocks.deleteDocumentMock).toHaveBeenCalledWith('rsvps', 'r1')
  })
})
