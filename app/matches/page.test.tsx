import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MatchesPage from './page'

const routerMock = { push: vi.fn() }

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
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
  useIsClubAdmin: () => ({
    isClubAdmin: false,
    isSuperUser: false,
    loading: false,
  }),
}))

const matchStoreState = {
  matches: [] as any[],
  setMatches: vi.fn((matches: any[]) => {
    matchStoreState.matches = matches
  }),
}

vi.mock('@/store/matchStore', () => ({
  useMatchStore: () => matchStoreState,
}))

const getAllMatchesMock = vi.fn()
const getMatchRsvpCountMock = vi.fn()

vi.mock('@/lib/services/matchService', () => ({
  getAllMatches: (...args: unknown[]) => getAllMatchesMock(...args),
}))
vi.mock('@/lib/services/rsvpService', () => ({
  getMatchRsvpCount: (...args: unknown[]) => getMatchRsvpCountMock(...args),
}))

vi.mock('@/components/matches/MatchCard', () => ({
  MatchCard: ({ match }: { match: { id: string } }) => (
    <div>MatchCard:{match.id}</div>
  ),
}))

vi.mock('@/components/admin/CreateMatchCard', () => ({
  CreateMatchCard: () => <div>CreateMatchCardMock</div>,
}))

function mockMatch(id: string, hoursFromNow = 24) {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000)
  return {
    id,
    date,
    time: '19:00',
    location: null,
    rsvpOpen: true,
    rsvpOpenAt: null,
    rsvpCloseAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('MatchesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matchStoreState.matches = []
    useAuthMock.mockReturnValue({
      user: { uid: 'user1' },
      userData: { uid: 'user1', activeClubId: null },
      loading: false,
    })
    useAdminMock.mockReturnValue({ isAdmin: false })
    useClubMembershipsMock.mockReturnValue({
      memberships: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
    getMatchRsvpCountMock.mockResolvedValue(0)
  })

  it('renders upcoming matches after a successful fetch', async () => {
    getAllMatchesMock.mockResolvedValueOnce([mockMatch('m1')])

    render(<MatchesPage />)

    expect(await screen.findByText('MatchCard:m1')).toBeInTheDocument()
    expect(screen.queryByText('No Matches')).not.toBeInTheDocument()
  })

  it('does not show No Matches while a fetch is still in flight', async () => {
    let resolveMatches: (value: unknown) => void = () => {}
    getAllMatchesMock.mockReturnValueOnce(
      new Promise(resolve => {
        resolveMatches = resolve
      })
    )

    render(<MatchesPage />)

    expect(screen.queryByText('No Matches')).not.toBeInTheDocument()
    expect(screen.queryByText('MatchCard:m1')).not.toBeInTheDocument()

    resolveMatches([mockMatch('m1')])
    expect(await screen.findByText('MatchCard:m1')).toBeInTheDocument()
  })

  it('does not treat a superseded fetch failure as an empty list', async () => {
    let rejectFirst: (error: Error) => void = () => {}
    let resolveSecond: (value: unknown) => void = () => {}

    getAllMatchesMock
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectFirst = reject
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveSecond = resolve
          })
      )

    const { rerender } = render(<MatchesPage />)

    // Bump effect generation via userId change (e.g. auth object churn)
    useAuthMock.mockReturnValue({
      user: { uid: 'user2' },
      userData: { uid: 'user2', activeClubId: null },
      loading: false,
    })
    rerender(<MatchesPage />)

    rejectFirst(new Error('stale failure'))
    await Promise.resolve()

    expect(screen.queryByText('No Matches')).not.toBeInTheDocument()

    resolveSecond([mockMatch('m2')])
    expect(await screen.findByText('MatchCard:m2')).toBeInTheDocument()
  })

  it('shows an error retry state when the only fetch fails', async () => {
    getAllMatchesMock.mockRejectedValueOnce(new Error('network'))

    render(<MatchesPage />)

    expect(await screen.findByText('Could not load matches')).toBeInTheDocument()
    expect(screen.queryByText('No Matches')).not.toBeInTheDocument()

    getAllMatchesMock.mockResolvedValueOnce([mockMatch('m3')])
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => {
      expect(screen.getByText('MatchCard:m3')).toBeInTheDocument()
    })
  })

  it('filters matches to the user active club membership', async () => {
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
          club: { id: 'club-a', name: 'A', slug: 'a' },
        },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
    getAllMatchesMock.mockResolvedValueOnce([
      { ...mockMatch('m-a'), clubId: 'club-a' },
      { ...mockMatch('m-b'), clubId: 'club-b' },
      { ...mockMatch('m-null'), clubId: null },
    ])

    render(<MatchesPage />)

    expect(await screen.findByText('MatchCard:m-a')).toBeInTheDocument()
    expect(screen.getByText('MatchCard:m-null')).toBeInTheDocument()
    expect(screen.queryByText('MatchCard:m-b')).not.toBeInTheDocument()
  })

  it('prompts orphans to join a club', async () => {
    getAllMatchesMock.mockResolvedValueOnce([
      { ...mockMatch('m-stamped'), clubId: 'club-a' },
    ])

    render(<MatchesPage />)

    expect(await screen.findByText('Join a club')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /enter invite code/i })).toHaveAttribute(
      'href',
      '/join'
    )
    expect(screen.queryByText('MatchCard:m-stamped')).not.toBeInTheDocument()
  })

  it('scopes matches to the same fallback club as the sub-nav when activeClubId is unset', async () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'user1' },
      userData: { uid: 'user1', activeClubId: null },
      loading: false,
    })
    useClubMembershipsMock.mockReturnValue({
      memberships: [
        {
          id: 'mem-z',
          clubId: 'club-z',
          userId: 'user1',
          role: 'player',
          status: 'active',
          joinedAt: new Date(),
          updatedAt: new Date(),
          club: { id: 'club-z', name: 'Zulu FC', slug: 'zulu' },
        },
        {
          id: 'mem-a',
          clubId: 'club-a',
          userId: 'user1',
          role: 'club_admin',
          status: 'active',
          joinedAt: new Date(),
          updatedAt: new Date(),
          club: { id: 'club-a', name: 'Alpha FC', slug: 'alpha' },
        },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
    getAllMatchesMock.mockResolvedValueOnce([
      { ...mockMatch('m-a'), clubId: 'club-a' },
      { ...mockMatch('m-z'), clubId: 'club-z' },
    ])

    render(<MatchesPage />)

    // Alphabetical fallback is Alpha FC — same as ClubSubNav.
    expect(await screen.findByText('MatchCard:m-a')).toBeInTheDocument()
    expect(screen.queryByText('MatchCard:m-z')).not.toBeInTheDocument()
    expect(screen.getByText('CreateMatchCardMock')).toBeInTheDocument()
  })

  it('hides create match when the user is only a player on the active club', async () => {
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
          club: { id: 'club-a', name: 'A', slug: 'a' },
        },
        {
          id: 'mem2',
          clubId: 'club-b',
          userId: 'user1',
          role: 'club_admin',
          status: 'active',
          joinedAt: new Date(),
          updatedAt: new Date(),
          club: { id: 'club-b', name: 'B', slug: 'b' },
        },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
    getAllMatchesMock.mockResolvedValueOnce([])

    render(<MatchesPage />)

    expect(await screen.findByText('No Matches')).toBeInTheDocument()
    expect(screen.queryByText('CreateMatchCardMock')).not.toBeInTheDocument()
  })

  it('shows create match when the user is club_admin of the active club', async () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'user1' },
      userData: { uid: 'user1', activeClubId: 'club-b' },
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
          club: { id: 'club-a', name: 'A', slug: 'a' },
        },
        {
          id: 'mem2',
          clubId: 'club-b',
          userId: 'user1',
          role: 'club_admin',
          status: 'active',
          joinedAt: new Date(),
          updatedAt: new Date(),
          club: { id: 'club-b', name: 'B', slug: 'b' },
        },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
    getAllMatchesMock.mockResolvedValueOnce([])

    render(<MatchesPage />)

    expect(await screen.findByText('CreateMatchCardMock')).toBeInTheDocument()
  })
})
