import { beforeEach, describe, expect, it, vi } from 'vitest'

const globalMutateMock = vi.fn()
const getStateMock = vi.fn()
const setUserDataMock = vi.fn()

vi.mock('swr', () => ({
  default: vi.fn(),
  mutate: (...args: unknown[]) => globalMutateMock(...args),
}))

vi.mock('@/lib/api/client', () => ({
  getMyClubsAPI: vi.fn(),
}))

vi.mock('@/store/authStore', () => ({
  useAuthStore: Object.assign(
    (selector: (state: unknown) => unknown) => selector({}),
    {
      getState: () => getStateMock(),
    }
  ),
}))

vi.mock('./useAuth', () => ({
  useAuth: () => ({ user: null, userData: null }),
}))

describe('afterInviteRedeemed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getStateMock.mockReturnValue({
      userData: { uid: 'u1', activeClubId: null },
      setUserData: setUserDataMock,
    })
  })

  it('revalidates my-clubs and sets activeClubId when unset', async () => {
    const { afterInviteRedeemed, myClubsKey } = await import(
      './useClubMemberships'
    )
    await afterInviteRedeemed({
      uid: 'u1',
      clubId: 'club-a',
      alreadyMember: false,
    })

    expect(globalMutateMock).toHaveBeenCalledWith(myClubsKey('u1'))
    expect(setUserDataMock).toHaveBeenCalledWith(
      expect.objectContaining({ activeClubId: 'club-a' })
    )
  })

  it('does not overwrite an existing activeClubId', async () => {
    getStateMock.mockReturnValue({
      userData: { uid: 'u1', activeClubId: 'club-existing' },
      setUserData: setUserDataMock,
    })
    const { afterInviteRedeemed } = await import('./useClubMemberships')
    await afterInviteRedeemed({
      uid: 'u1',
      clubId: 'club-a',
      alreadyMember: false,
    })

    expect(setUserDataMock).not.toHaveBeenCalled()
  })

  it('skips activeClubId sync for alreadyMember', async () => {
    const { afterInviteRedeemed } = await import('./useClubMemberships')
    await afterInviteRedeemed({
      uid: 'u1',
      clubId: 'club-a',
      alreadyMember: true,
    })

    expect(setUserDataMock).not.toHaveBeenCalled()
  })
})
