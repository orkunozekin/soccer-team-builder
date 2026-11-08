import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MatchDetailView } from './MatchDetailView'

const routerMock = {
  push: vi.fn(),
}

const paramsMock = vi.fn<() => Record<string, string>>(() => ({
  matchId: 'match1',
}))

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

const flagMock = vi.fn((_key: string) => false)
vi.mock('@/lib/flags/useFeatureFlag', () => ({
  useFeatureFlag: (key: string) => flagMock(key),
  useFeatureFlagReady: () => true,
}))

const getClubSkillRankingMock = vi.fn()
const saveClubSkillRankingMock = vi.fn()
vi.mock('@/lib/api/client', () => ({
  getClubSkillRankingAPI: (...args: unknown[]) =>
    getClubSkillRankingMock(...args),
  saveClubSkillRankingAPI: (...args: unknown[]) =>
    saveClubSkillRankingMock(...args),
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
  MatchDetails: ({
    rsvpCount,
    readOnly,
  }: {
    rsvpCount: number
    readOnly?: boolean
  }) => (
    <div data-read-only={String(!!readOnly)}>MatchDetailsMock:{rsvpCount}</div>
  ),
}))

vi.mock('@/components/teams/TeamsDisplay', () => ({
  TeamsDisplay: ({
    users,
    headerActions,
    onTeamsChanged,
  }: {
    users: { uid: string }[]
    headerActions?: React.ReactNode
    onTeamsChanged?: () => void
  }) => (
    <div>
      TeamsDisplayMock:{users.length}
      {headerActions}
      <button onClick={() => onTeamsChanged?.()}>MoveTeamPlayerMock</button>
    </div>
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
  RebalanceTeamsButton: ({
    onSkillBalanced,
  }: {
    onSkillBalanced?: (summary: unknown) => void
  }) => (
    <button
      onClick={() =>
        onSkillBalanced?.({
          teams: [
            { teamNumber: 1, total: 10, average: 2.5, size: 4 },
            { teamNumber: 2, total: 9.5, average: 2.38, size: 4 },
          ],
          unratedCount: 2,
          playerCount: 8,
        })
      }
    >
      RebalanceTeamsButtonMock
    </button>
  ),
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
    flagMock.mockImplementation(() => false)
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

  it.each([
    [false, 'true'],
    [true, 'false'],
  ])(
    'makes a past match read-only unless the viewer manages it (admin: %s)',
    async (isClubAdmin, expected) => {
      useIsClubAdminMock.mockReturnValue({
        isClubAdmin,
        isSuperUser: false,
        loading: false,
        error: null,
        refresh: refreshClubMembershipsMock,
      })
      getMatchMock.mockResolvedValueOnce({
        ...mockMatch(),
        date: new Date('2020-01-01T18:00:00Z'),
      })
      getMatchRSVPsMock.mockResolvedValueOnce([])
      getMatchTeamsMock.mockResolvedValueOnce([])
      getUsersByIdsMock.mockResolvedValueOnce([])

      render(<MatchDetailView backLink={backLink} />)

      expect(await screen.findByText('MatchDetailsMock:0')).toHaveAttribute(
        'data-read-only',
        expected
      )
    }
  )

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

  it('shows the skill strength card to admins after a skill rebalance', async () => {
    const user = userEvent.setup()
    const adminState = {
      isClubAdmin: true,
      isSuperUser: false,
      loading: false,
      error: null,
      refresh: refreshClubMembershipsMock,
    }
    useIsClubAdminMock.mockReturnValue(adminState)
    paramsMock.mockReturnValue({ matchId: 'match1', slug: 'fc-test' })
    getMatchMock.mockResolvedValueOnce({ ...mockMatch(), clubId: 'club1' })
    getMatchRSVPsMock.mockResolvedValueOnce([])
    getMatchTeamsMock.mockResolvedValueOnce([
      mockTeam('t1'),
      { ...mockTeam('t2'), teamNumber: 2, name: 'Team 2', playerIds: [] },
    ])
    getUsersByIdsMock.mockResolvedValue([])

    const { rerender } = render(<MatchDetailView backLink={backLink} />)
    await user.click(await screen.findByText('RebalanceTeamsButtonMock'))

    expect(screen.getByText('Balanced by skill')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Rate players' })).toHaveAttribute(
      'href',
      '/c/fc-test/roster'
    )

    // Losing manage permission hides it immediately.
    useIsClubAdminMock.mockReturnValue({ ...adminState, isClubAdmin: false })
    rerender(<MatchDetailView backLink={backLink} />)
    expect(screen.queryByText('Balanced by skill')).not.toBeInTheDocument()

    useIsClubAdminMock.mockReturnValue(adminState)
    rerender(<MatchDetailView backLink={backLink} />)
    expect(screen.getByText('Balanced by skill')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: /dismiss skill balance summary/i })
    )
    expect(screen.queryByText('Balanced by skill')).not.toBeInTheDocument()
  })

  it('clears the skill strength card after another roster change', async () => {
    const user = userEvent.setup()
    useIsClubAdminMock.mockReturnValue({
      isClubAdmin: true,
      isSuperUser: false,
      loading: false,
      error: null,
      refresh: refreshClubMembershipsMock,
    })
    getMatchMock.mockResolvedValue({ ...mockMatch(), clubId: 'club1' })
    getMatchRSVPsMock.mockResolvedValue([])
    getMatchTeamsMock.mockResolvedValue([
      mockTeam('t1'),
      { ...mockTeam('t2'), teamNumber: 2, name: 'Team 2', playerIds: [] },
    ])
    getUsersByIdsMock.mockResolvedValue([])

    render(<MatchDetailView backLink={backLink} />)
    await user.click(await screen.findByText('RebalanceTeamsButtonMock'))
    expect(screen.getByText('Balanced by skill')).toBeInTheDocument()

    await user.click(screen.getByText('MoveTeamPlayerMock'))
    expect(screen.queryByText('Balanced by skill')).not.toBeInTheDocument()
  })

  describe('Rate players', () => {
    const adminState = {
      isClubAdmin: true,
      isSuperUser: false,
      loading: false,
      error: null,
      refresh: refreshClubMembershipsMock,
    }

    function setupRatedMatch(ratings: Record<string, number>) {
      useIsClubAdminMock.mockReturnValue(adminState)
      flagMock.mockImplementation(key => key === 'skill-balanced-teams')
      getMatchMock.mockResolvedValue({ ...mockMatch(), clubId: 'club1' })
      getMatchRSVPsMock.mockResolvedValue([
        mockRsvp('user1'),
        mockRsvp('user2'),
      ])
      getMatchTeamsMock.mockResolvedValue([
        mockTeam('t1'),
        {
          ...mockTeam('t2'),
          teamNumber: 2,
          name: 'Team 2',
          color: 'blue',
          playerIds: ['user2'],
        },
      ])
      getUsersByIdsMock.mockResolvedValue([
        { uid: 'user1', displayName: 'Alice', position: 'ST' },
        { uid: 'user2', displayName: 'Bob', position: 'GK' },
      ])
      getClubSkillRankingMock.mockResolvedValue({
        success: true,
        ranking: { ratings, version: 1 },
        members: [
          { userId: 'user1', displayName: 'Alice', position: 'ST' },
          { userId: 'user2', displayName: 'Bob', position: 'GK' },
        ],
      })
    }

    const rateButton = () =>
      screen.findByRole('button', { name: /^Rate players/ })

    it('shows admins the CTA while a player is unrated, and saves from the sheet', async () => {
      const user = userEvent.setup()
      setupRatedMatch({ user1: 7 })
      saveClubSkillRankingMock.mockResolvedValue({
        success: true,
        ranking: { ratings: { user1: 7, user2: 4 }, version: 2 },
      })
      render(<MatchDetailView backLink={backLink} />)

      const cta = await rateButton()
      expect(cta).toHaveTextContent('1 of 2 not rated yet')
      expect(getClubSkillRankingMock).toHaveBeenCalledWith('club1')

      await user.click(cta)
      expect(await screen.findByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Team 2 · GK')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /^Bob/ }))
      await user.click(screen.getByRole('radio', { name: '4' }))
      await user.click(screen.getByRole('button', { name: 'Save ratings' }))

      expect(saveClubSkillRankingMock).toHaveBeenCalledWith('club1', {
        user2: 4,
      })
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      )
      // Everyone is rated now, so the CTA goes away.
      expect(
        screen.queryByRole('button', { name: /^Rate players/ })
      ).not.toBeInTheDocument()
    })

    it('hides the CTA once every player is rated', async () => {
      setupRatedMatch({ user1: 7, user2: 3 })
      render(<MatchDetailView backLink={backLink} />)

      await waitFor(() =>
        expect(getClubSkillRankingMock).toHaveBeenCalledWith('club1')
      )
      expect(await screen.findByText('TeamsDisplayMock:2')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /^Rate players/ })
      ).not.toBeInTheDocument()
    })

    it.each([
      ['a regular player', { isClubAdmin: false }, true],
      ['an admin with the flag off', {}, false],
    ])('hides the CTA from %s', async (_label, override, flagOn) => {
      setupRatedMatch({})
      useIsClubAdminMock.mockReturnValue({ ...adminState, ...override })
      flagMock.mockImplementation(
        key => flagOn && key === 'skill-balanced-teams'
      )
      render(<MatchDetailView backLink={backLink} />)

      expect(await screen.findByText('TeamsDisplayMock:2')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /^Rate players/ })
      ).not.toBeInTheDocument()
      expect(getClubSkillRankingMock).not.toHaveBeenCalled()
    })
  })
})
