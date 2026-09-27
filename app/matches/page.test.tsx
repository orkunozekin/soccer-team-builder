import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MatchesRedirectPage from './page'

const replaceMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}))

const useAuthMock = vi.fn()
vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

const useClubMembershipsMock = vi.fn()
vi.mock('@/lib/hooks/useClubMemberships', () => ({
  useClubMemberships: () => useClubMembershipsMock(),
}))

describe('MatchesRedirectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({
      user: { uid: 'user1' },
      userData: { uid: 'user1', activeClubId: 'club-a' },
      loading: false,
    })
    useClubMembershipsMock.mockReturnValue({
      memberships: [
        {
          id: 'mem1',
          clubId: 'club-a',
          userId: 'user1',
          role: 'player',
          status: 'active',
          joinedAt: new Date(),
          updatedAt: new Date(),
          club: {
            id: 'club-a',
            name: 'Alpha',
            slug: 'alpha',
            settings: { allowPlayerInvites: false },
          },
        },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
  })

  it('redirects to /c/{slug}/matches for the active club', async () => {
    render(<MatchesRedirectPage />)
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/c/alpha/matches')
    })
  })

  it('sends users with no membership to /join', async () => {
    useClubMembershipsMock.mockReturnValue({
      memberships: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
    render(<MatchesRedirectPage />)
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/join')
    })
  })

  it('sends signed-out users to /login', async () => {
    useAuthMock.mockReturnValue({
      user: null,
      userData: null,
      loading: false,
    })
    render(<MatchesRedirectPage />)
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login')
    })
  })
})
