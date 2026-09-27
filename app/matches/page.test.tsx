import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MatchesRedirectPage from './page'

const replaceMock = vi.fn()
const searchMocks = vi.hoisted(() => ({
  scope: null as string | null,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'scope' ? searchMocks.scope : null),
  }),
}))

const useAuthMock = vi.fn()
vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

const useAdminMock = vi.fn()
vi.mock('@/lib/hooks/useAdmin', () => ({
  useAdmin: () => useAdminMock(),
}))

const useClubMembershipsMock = vi.fn()
vi.mock('@/lib/hooks/useClubMemberships', () => ({
  useClubMemberships: () => useClubMembershipsMock(),
}))

vi.mock('@/components/matches/ClubMatchesView', () => ({
  ClubMatchesView: ({ clubId }: { clubId: string | null }) => (
    <div>AllClubsMatches:{String(clubId)}</div>
  ),
}))

describe('MatchesRedirectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchMocks.scope = null
    useAuthMock.mockReturnValue({
      user: { uid: 'user1' },
      userData: { uid: 'user1', activeClubId: 'club-a' },
      loading: false,
    })
    useAdminMock.mockReturnValue({ isAdmin: false })
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

  it('forwards all-clubs scope for a super user with a membership', async () => {
    searchMocks.scope = 'all'
    useAdminMock.mockReturnValue({ isAdmin: true })
    render(<MatchesRedirectPage />)
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/c/alpha/matches?scope=all')
    })
  })

  it('does not forward all-clubs scope for a player', async () => {
    searchMocks.scope = 'all'
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

  it('keeps the all-clubs list for super users with no membership', async () => {
    useAdminMock.mockReturnValue({ isAdmin: true })
    useClubMembershipsMock.mockReturnValue({
      memberships: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
    render(<MatchesRedirectPage />)
    expect(await screen.findByText('AllClubsMatches:null')).toBeInTheDocument()
    expect(replaceMock).not.toHaveBeenCalledWith('/join')
  })

  it('shows retry instead of /join when memberships fail to load', async () => {
    const refresh = vi.fn()
    useClubMembershipsMock.mockReturnValue({
      memberships: [],
      loading: false,
      error: 'Failed to load clubs',
      refresh,
    })
    render(<MatchesRedirectPage />)
    expect(await screen.findByText(/could not load clubs/i)).toBeInTheDocument()
    expect(replaceMock).not.toHaveBeenCalledWith('/join')
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
