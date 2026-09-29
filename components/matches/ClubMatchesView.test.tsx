import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClubMatchesView } from './ClubMatchesView'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
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

const listMatchesForViewerMock = vi.fn()
const getMatchRsvpCountMock = vi.fn()

vi.mock('@/lib/services/matchService', () => ({
  listMatchesForViewer: (...args: unknown[]) =>
    listMatchesForViewerMock(...args),
}))
vi.mock('@/lib/services/rsvpService', () => ({
  getMatchRsvpCount: (...args: unknown[]) => getMatchRsvpCountMock(...args),
}))

vi.mock('@/components/matches/MatchCard', () => ({
  MatchCard: ({ match, href }: { match: { id: string }; href?: string }) => (
    <div>
      MatchCard:{match.id}:{href}
    </div>
  ),
}))

vi.mock('@/components/admin/CreateMatchCard', () => ({
  CreateMatchCard: () => <div>CreateMatchCardMock</div>,
}))

vi.mock('@/components/admin/AdminMatchCard', () => ({
  AdminMatchCard: ({
    match,
    href,
  }: {
    match: { id: string }
    href?: string
  }) => (
    <div>
      AdminMatchCard:{match.id}:{href}
    </div>
  ),
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

function renderView(clubId = 'club-a', clubSlug = 'alpha') {
  return render(<ClubMatchesView clubId={clubId} clubSlug={clubSlug} />)
}

describe('ClubMatchesView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matchStoreState.matches = []
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
            name: 'A',
            slug: 'alpha',
            settings: { allowPlayerInvites: false },
          },
        },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
    getMatchRsvpCountMock.mockResolvedValue(0)
  })

  it('renders upcoming matches after a successful fetch', async () => {
    listMatchesForViewerMock.mockResolvedValueOnce([mockMatch('m1')])

    renderView()

    expect(
      await screen.findByText('MatchCard:m1:/c/alpha/matches/m1')
    ).toBeInTheDocument()
    expect(screen.queryByText('No Matches')).not.toBeInTheDocument()
  })

  it('does not show No Matches while a fetch is still in flight', async () => {
    let resolveMatches: (value: unknown) => void = () => {}
    listMatchesForViewerMock.mockReturnValueOnce(
      new Promise(resolve => {
        resolveMatches = resolve
      })
    )

    renderView()

    expect(screen.queryByText('No Matches')).not.toBeInTheDocument()
    expect(screen.queryByText(/MatchCard:m1/)).not.toBeInTheDocument()

    resolveMatches([mockMatch('m1')])
    expect(
      await screen.findByText('MatchCard:m1:/c/alpha/matches/m1')
    ).toBeInTheDocument()
  })

  it('does not treat a superseded fetch failure as an empty list', async () => {
    let rejectFirst: (error: Error) => void = () => {}
    let resolveSecond: (value: unknown) => void = () => {}

    listMatchesForViewerMock
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

    const { rerender } = renderView()

    useAuthMock.mockReturnValue({
      user: { uid: 'user2' },
      userData: { uid: 'user2', activeClubId: 'club-a' },
      loading: false,
    })
    rerender(<ClubMatchesView clubId="club-a" clubSlug="alpha" />)

    rejectFirst(new Error('stale failure'))
    await Promise.resolve()

    expect(screen.queryByText('No Matches')).not.toBeInTheDocument()

    resolveSecond([mockMatch('m2')])
    expect(
      await screen.findByText('MatchCard:m2:/c/alpha/matches/m2')
    ).toBeInTheDocument()
  })

  it('shows an error retry state when the only fetch fails', async () => {
    listMatchesForViewerMock.mockRejectedValueOnce(new Error('network'))

    renderView()

    expect(
      await screen.findByText('Could not load matches')
    ).toBeInTheDocument()
    expect(screen.queryByText('No Matches')).not.toBeInTheDocument()

    listMatchesForViewerMock.mockResolvedValueOnce([mockMatch('m3')])
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => {
      expect(
        screen.getByText('MatchCard:m3:/c/alpha/matches/m3')
      ).toBeInTheDocument()
    })
  })

  it('still shows matches when RSVP count fetch fails', async () => {
    listMatchesForViewerMock.mockResolvedValueOnce([mockMatch('m-ok')])
    getMatchRsvpCountMock.mockRejectedValueOnce(new Error('index missing'))

    renderView()

    expect(
      await screen.findByText('MatchCard:m-ok:/c/alpha/matches/m-ok')
    ).toBeInTheDocument()
    expect(screen.queryByText('Could not load matches')).not.toBeInTheDocument()
  })

  it('filters matches to the club from the URL', async () => {
    listMatchesForViewerMock.mockResolvedValueOnce([
      { ...mockMatch('m-a'), clubId: 'club-a' },
      { ...mockMatch('m-b'), clubId: 'club-b' },
      { ...mockMatch('m-null'), clubId: null },
    ])

    renderView('club-a', 'alpha')

    expect(
      await screen.findByText('MatchCard:m-a:/c/alpha/matches/m-a')
    ).toBeInTheDocument()
    expect(
      screen.getByText('MatchCard:m-null:/c/alpha/matches/m-null')
    ).toBeInTheDocument()
    expect(screen.queryByText(/MatchCard:m-b/)).not.toBeInTheDocument()
  })

  it('links all-clubs cards back to the admin list', async () => {
    useAdminMock.mockReturnValue({ isAdmin: true })
    listMatchesForViewerMock.mockResolvedValueOnce([mockMatch('m-all')])

    render(<ClubMatchesView clubId={null} clubSlug={null} />)

    expect(
      await screen.findByText('AdminMatchCard:m-all:/admin/matches/m-all')
    ).toBeInTheDocument()
  })

  it('hides create match on the all-clubs list when clubId is null', async () => {
    useAdminMock.mockReturnValue({ isAdmin: true })
    listMatchesForViewerMock.mockResolvedValueOnce([])

    render(<ClubMatchesView clubId={null} clubSlug={null} />)

    expect(await screen.findByText('No Matches')).toBeInTheDocument()
    expect(screen.queryByText('CreateMatchCardMock')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'All' }))
    expect(screen.getByText('No matches yet.')).toBeInTheDocument()
    expect(
      screen.queryByText('Create a match using the form above.')
    ).not.toBeInTheDocument()
  })

  it('hides create match when the user is only a player on this club', async () => {
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
            name: 'A',
            slug: 'alpha',
            settings: { allowPlayerInvites: false },
          },
        },
        {
          id: 'mem2',
          clubId: 'club-b',
          userId: 'user1',
          role: 'club_admin',
          status: 'active',
          joinedAt: new Date(),
          updatedAt: new Date(),
          club: {
            id: 'club-b',
            name: 'B',
            slug: 'beta',
            settings: { allowPlayerInvites: false },
          },
        },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
    listMatchesForViewerMock.mockResolvedValueOnce([])

    renderView('club-a', 'alpha')

    expect(await screen.findByText('No Matches')).toBeInTheDocument()
    expect(screen.queryByText('CreateMatchCardMock')).not.toBeInTheDocument()
  })

  it('keeps delete off unstamped matches for a club admin', async () => {
    useClubMembershipsMock.mockReturnValue({
      memberships: [
        {
          id: 'mem1',
          clubId: 'club-a',
          userId: 'user1',
          role: 'club_admin',
          status: 'active',
          joinedAt: new Date(),
          updatedAt: new Date(),
          club: {
            id: 'club-a',
            name: 'A',
            slug: 'alpha',
            settings: { allowPlayerInvites: false },
          },
        },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
    listMatchesForViewerMock.mockResolvedValueOnce([
      { ...mockMatch('owned'), clubId: 'club-a' },
      { ...mockMatch('legacy'), clubId: null },
    ])

    renderView('club-a', 'alpha')

    expect(
      await screen.findByText('AdminMatchCard:owned:/c/alpha/matches/owned')
    ).toBeInTheDocument()
    expect(
      screen.getByText('MatchCard:legacy:/c/alpha/matches/legacy')
    ).toBeInTheDocument()
    expect(screen.queryByText(/AdminMatchCard:legacy:/)).not.toBeInTheDocument()
  })

  it('shows create match when the user is club_admin of this club', async () => {
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
            name: 'A',
            slug: 'alpha',
            settings: { allowPlayerInvites: false },
          },
        },
        {
          id: 'mem2',
          clubId: 'club-b',
          userId: 'user1',
          role: 'club_admin',
          status: 'active',
          joinedAt: new Date(),
          updatedAt: new Date(),
          club: {
            id: 'club-b',
            name: 'B',
            slug: 'beta',
            settings: { allowPlayerInvites: false },
          },
        },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
    listMatchesForViewerMock.mockResolvedValueOnce([])

    renderView('club-b', 'beta')

    expect(await screen.findByText('CreateMatchCardMock')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Upcoming' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.queryByText(/^MatchCard:/)).not.toBeInTheDocument()
  })

  it('shows past matches on the admin list for club admins', async () => {
    useClubMembershipsMock.mockReturnValue({
      memberships: [
        {
          id: 'mem1',
          clubId: 'club-a',
          userId: 'user1',
          role: 'club_admin',
          status: 'active',
          joinedAt: new Date(),
          updatedAt: new Date(),
          club: {
            id: 'club-a',
            name: 'A',
            slug: 'alpha',
            settings: { allowPlayerInvites: false },
          },
        },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
    listMatchesForViewerMock.mockResolvedValueOnce([
      { ...mockMatch('upcoming', 24), clubId: 'club-a' },
      { ...mockMatch('past', -48), clubId: 'club-a' },
    ])

    renderView('club-a', 'alpha')

    expect(
      await screen.findByText(
        'AdminMatchCard:upcoming:/c/alpha/matches/upcoming'
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByText('AdminMatchCard:past:/c/alpha/matches/past')
    ).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Past' }))
    expect(
      screen.getByText('AdminMatchCard:past:/c/alpha/matches/past')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('AdminMatchCard:upcoming:/c/alpha/matches/upcoming')
    ).not.toBeInTheDocument()
  })

  it('counts only upcoming matches on initial admin load, then past on tab open', async () => {
    useClubMembershipsMock.mockReturnValue({
      memberships: [
        {
          id: 'mem1',
          clubId: 'club-a',
          userId: 'user1',
          role: 'club_admin',
          status: 'active',
          joinedAt: new Date(),
          updatedAt: new Date(),
          club: {
            id: 'club-a',
            name: 'A',
            slug: 'alpha',
            settings: { allowPlayerInvites: false },
          },
        },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
    listMatchesForViewerMock.mockResolvedValueOnce([
      { ...mockMatch('upcoming', 24), clubId: 'club-a' },
      { ...mockMatch('past', -48), clubId: 'club-a' },
    ])

    renderView('club-a', 'alpha')

    await screen.findByText('AdminMatchCard:upcoming:/c/alpha/matches/upcoming')
    await waitFor(() => {
      expect(getMatchRsvpCountMock).toHaveBeenCalledWith('upcoming')
    })
    expect(getMatchRsvpCountMock).not.toHaveBeenCalledWith('past')

    await userEvent.click(screen.getByRole('tab', { name: 'Past' }))
    await waitFor(() => {
      expect(getMatchRsvpCountMock).toHaveBeenCalledWith('past')
    })
  })

  it('uses denormalized rsvpConfirmedCount without querying RSVPs', async () => {
    listMatchesForViewerMock.mockResolvedValueOnce([
      { ...mockMatch('m-denorm'), rsvpConfirmedCount: 12 },
    ])

    renderView()

    expect(
      await screen.findByText('MatchCard:m-denorm:/c/alpha/matches/m-denorm')
    ).toBeInTheDocument()
    expect(getMatchRsvpCountMock).not.toHaveBeenCalled()
  })
})
