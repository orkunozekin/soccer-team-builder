import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MatchDetailView } from './MatchDetailView'

const routerMock = {
  push: vi.fn(),
}

const paramsMock = vi.fn(() => ({ matchId: 'match1' }))

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useParams: () => paramsMock(),
}))

const useAuthMock = vi.fn()
vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

const useAdminMock = vi.fn()
vi.mock('@/lib/hooks/useAdmin', () => ({
  useAdmin: () => useAdminMock(),
}))

const useIsClubAdminMock = vi.fn()
const refreshClubMembershipsMock = vi.fn()
vi.mock('@/lib/hooks/useClubMemberships', () => ({
  useIsClubAdmin: (...args: unknown[]) => useIsClubAdminMock(...args),
  useClubMemberships: () => ({
    memberships: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))

const matchStoreState = {
  currentMatch: null as any,
  matchRSVPs: [] as any[],
  setCurrentMatch: vi.fn((match: any) => {
    matchStoreState.currentMatch = match
  }),
  setMatchRSVPs: vi.fn((rsvps: any[]) => {
    matchStoreState.matchRSVPs = rsvps
  }),
}

vi.mock('@/store/matchStore', () => ({
  useMatchStore: () => matchStoreState,
}))

const getMatchMock = vi.fn()
const getMatchRSVPsMock = vi.fn()
const getMatchTeamsMock = vi.fn()
const getUsersByIdsMock = vi.fn()

vi.mock('@/lib/services/matchService', () => ({
  getMatch: (...args: unknown[]) => getMatchMock(...args),
}))
vi.mock('@/lib/services/rsvpService', () => ({
  getMatchRSVPs: (...args: unknown[]) => getMatchRSVPsMock(...args),
}))
vi.mock('@/lib/services/teamService', () => ({
  getMatchTeams: (...args: unknown[]) => getMatchTeamsMock(...args),
}))
vi.mock('@/lib/services/userService', () => ({
  getUsersByIds: (...args: unknown[]) => getUsersByIdsMock(...args),
}))

vi.mock('@/components/matches/MatchDetails', () => ({
  MatchDetails: ({ rsvpCount }: { rsvpCount: number }) => (
    <div>MatchDetailsMock:{rsvpCount}</div>
  ),
}))

vi.mock('@/components/teams/TeamsDisplay', () => ({
  TeamsDisplay: ({ users }: { users: { uid: string }[] }) => (
    <div>TeamsDisplayMock:{users.length}</div>
  ),
}))

vi.mock('@/components/admin/EditMatchCard', () => ({
  EditMatchCard: () => <div>EditMatchCardMock</div>,
}))

vi.mock('@/components/admin/ImpersonateRSVP', () => ({
  ImpersonateRSVP: () => <div>ImpersonateRSVPMock</div>,
}))

vi.mock('@/components/admin/PlayerTransfer', () => ({
  PlayerTransfer: () => <div>PlayerTransferMock</div>,
}))

vi.mock('@/components/admin/RebalanceTeamsButton', () => ({
  RebalanceTeamsButton: () => <button>RebalanceTeamsButtonMock</button>,
}))

vi.mock('@/components/admin/RsvpOrderCard', () => ({
  RsvpOrderCard: () => <div>RsvpOrderCardMock</div>,
}))

const backLink = { href: '/matches', label: 'Back to matches' }

function mockMatch(id = 'match1') {
  return {
    id,
    date: new Date(),
    time: '19:00',
    location: null,
    rsvpOpen: true,
    rsvpOpenAt: null,
    rsvpCloseAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function mockTeam(id = 't1') {
  return {
    id,
    matchId: 'match1',
    teamNumber: 1,
    name: 'Team 1',
    color: 'red',
    playerIds: ['user1'],
    maxSize: 11,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function mockRsvp(userId = 'user1') {
  return {
    id: `rsvp_${userId}`,
    matchId: 'match1',
    userId,
    status: 'confirmed' as const,
    position: null,
    jerseyNumber: null,
    attended: null,
    checkedInAt: null,
    checkInMethod: null,
    rsvpAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('MatchDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matchStoreState.currentMatch = null
    matchStoreState.matchRSVPs = []
    paramsMock.mockReturnValue({ matchId: 'match1' })
    useAuthMock.mockReturnValue({
      user: { uid: 'user1' },
      userData: { uid: 'user1', position: 'ST' },
    })
    useAdminMock.mockReturnValue({ isAdmin: false })
    useIsClubAdminMock.mockReturnValue({
      isClubAdmin: false,
      isSuperUser: false,
      loading: false,
      error: null,
      refresh: refreshClubMembershipsMock,
    })
  })

  it('renders match and teams details for regular user', async () => {
    getMatchMock.mockResolvedValueOnce(mockMatch())
    getMatchRSVPsMock.mockResolvedValueOnce([])
    getMatchTeamsMock.mockResolvedValueOnce([mockTeam()])
    getUsersByIdsMock.mockResolvedValueOnce([])

    render(<MatchDetailView backLink={backLink} />)

    expect(await screen.findByText('MatchDetailsMock:0')).toBeInTheDocument()
    expect(screen.getByText('TeamsDisplayMock:1')).toBeInTheDocument()
    expect(screen.queryByText('EditMatchCardMock')).not.toBeInTheDocument()
  })

  it('shows admin controls when user is club admin or super user', async () => {
    useIsClubAdminMock.mockReturnValue({
      isClubAdmin: true,
      isSuperUser: true,
      loading: false,
      error: null,
      refresh: refreshClubMembershipsMock,
    })

    getMatchMock.mockResolvedValueOnce(mockMatch())
    getMatchRSVPsMock.mockResolvedValueOnce([])
    getMatchTeamsMock.mockResolvedValueOnce([
      mockTeam('t1'),
      {
        ...mockTeam('t2'),
        teamNumber: 2,
        name: 'Team 2',
        color: 'blue',
        playerIds: [],
      },
    ])
    getUsersByIdsMock.mockResolvedValueOnce([])

    render(<MatchDetailView backLink={backLink} />)

    await screen.findByText('MatchDetailsMock:0')

    expect(screen.getByText('EditMatchCardMock')).toBeInTheDocument()
    expect(screen.getByText('ImpersonateRSVPMock')).toBeInTheDocument()
    expect(screen.getByText('TeamsDisplayMock:1')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('PlayerTransferMock')).toBeInTheDocument()
    })
  })

  it('surfaces a retry when club permissions cannot be loaded', async () => {
    useIsClubAdminMock.mockReturnValue({
      isClubAdmin: false,
      isSuperUser: false,
      loading: false,
      error: 'Failed to load clubs',
      refresh: refreshClubMembershipsMock,
    })
    getMatchMock.mockResolvedValueOnce({ ...mockMatch(), clubId: 'club1' })
    getMatchRSVPsMock.mockResolvedValueOnce([])
    getMatchTeamsMock.mockResolvedValueOnce([])
    getUsersByIdsMock.mockResolvedValueOnce([])

    render(<MatchDetailView backLink={backLink} />)

    expect(
      await screen.findByText(/couldn't verify your club permissions/i)
    ).toBeInTheDocument()
    expect(screen.queryByText('EditMatchCardMock')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(refreshClubMembershipsMock).toHaveBeenCalledTimes(1)
  })

  it('keeps pitch roster placeholders when profile fetch never resolves', async () => {
    getMatchMock.mockResolvedValueOnce(mockMatch())
    getMatchRSVPsMock.mockResolvedValueOnce([mockRsvp('user1')])
    getMatchTeamsMock.mockResolvedValueOnce([mockTeam()])
    getUsersByIdsMock.mockReturnValueOnce(new Promise(() => {}))

    render(<MatchDetailView backLink={backLink} />)

    expect(await screen.findByText('MatchDetailsMock:1')).toBeInTheDocument()
    // Placeholder from team playerIds so SoccerPitch is not empty.
    expect(screen.getByText('TeamsDisplayMock:1')).toBeInTheDocument()
  })

  it('recovers when matchId is missing on the first paint then arrives', async () => {
    let params: { matchId?: string } = {}
    paramsMock.mockImplementation(() => params)
    getMatchMock.mockResolvedValueOnce(mockMatch())
    getMatchRSVPsMock.mockResolvedValueOnce([])
    getMatchTeamsMock.mockResolvedValueOnce([])
    getUsersByIdsMock.mockResolvedValueOnce([])

    const { rerender } = render(<MatchDetailView backLink={backLink} />)

    expect(screen.queryByText(/MatchDetailsMock/)).not.toBeInTheDocument()

    params = { matchId: 'match1' }
    rerender(<MatchDetailView backLink={backLink} />)

    expect(await screen.findByText('MatchDetailsMock:0')).toBeInTheDocument()
  })

  it('does not render a stale store match while loading a different matchId', async () => {
    matchStoreState.currentMatch = mockMatch('old-match')
    let resolveMatch: (value: unknown) => void = () => {}
    getMatchMock.mockReturnValueOnce(
      new Promise(resolve => {
        resolveMatch = resolve
      })
    )
    getMatchRSVPsMock.mockResolvedValueOnce([])
    getMatchTeamsMock.mockResolvedValueOnce([])
    getUsersByIdsMock.mockResolvedValueOnce([])

    render(<MatchDetailView backLink={backLink} />)

    expect(screen.queryByText(/MatchDetailsMock/)).not.toBeInTheDocument()

    resolveMatch(mockMatch('match1'))

    expect(await screen.findByText('MatchDetailsMock:0')).toBeInTheDocument()
  })

  it('does not reveal match details before teams and RSVPs resolve', async () => {
    let resolveTeams: (value: unknown) => void = () => {}
    getMatchMock.mockResolvedValue(mockMatch())
    getMatchRSVPsMock.mockResolvedValue([mockRsvp(), mockRsvp('user2')])
    getMatchTeamsMock.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveTeams = resolve
        })
    )
    getUsersByIdsMock.mockResolvedValue([])

    render(<MatchDetailView backLink={backLink} />)

    await waitFor(() => {
      expect(getMatchMock).toHaveBeenCalled()
    })
    // Match doc may be ready, but UI must stay on the skeleton until roster
    // data is applied — otherwise we paint "0 confirmed" / no teams.
    expect(screen.queryByText(/MatchDetailsMock/)).not.toBeInTheDocument()

    resolveTeams([mockTeam()])

    expect(await screen.findByText('MatchDetailsMock:2')).toBeInTheDocument()
    expect(screen.getByText('TeamsDisplayMock:2')).toBeInTheDocument()
  })
})
