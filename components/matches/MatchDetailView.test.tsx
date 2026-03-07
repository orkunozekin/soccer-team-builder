import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MatchDetailView } from './MatchDetailView'

const routerMock = {
  push: vi.fn(),
}

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useParams: () => ({ matchId: 'match1' }),
}))

const useAuthMock = vi.fn()
vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

const useAdminMock = vi.fn()
vi.mock('@/lib/hooks/useAdmin', () => ({
  useAdmin: () => useAdminMock(),
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
const getAllUsersMock = vi.fn()

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
  getAllUsers: (...args: unknown[]) => getAllUsersMock(...args),
}))

vi.mock('@/components/matches/MatchDetails', () => ({
  MatchDetails: () => <div>MatchDetailsMock</div>,
}))

vi.mock('@/components/teams/TeamsDisplay', () => ({
  TeamsDisplay: () => <div>TeamsDisplayMock</div>,
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

const backLink = { href: '/matches', label: 'Back to matches' }

describe('MatchDetailView', () => {
  it('renders match and teams details for regular user', async () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'user1' },
      userData: { uid: 'user1', position: 'ST' },
    })
    useAdminMock.mockReturnValue({ isAdmin: false })

    getMatchMock.mockResolvedValueOnce({
      id: 'match1',
      date: new Date(),
      time: '19:00',
      location: null,
      rsvpOpen: true,
      rsvpOpenAt: null,
      rsvpCloseAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    getMatchRSVPsMock.mockResolvedValueOnce([])
    getMatchTeamsMock.mockResolvedValueOnce([
      {
        id: 't1',
        matchId: 'match1',
        teamNumber: 1,
        name: 'Team 1',
        color: 'red',
        playerIds: [],
        maxSize: 11,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    getAllUsersMock.mockResolvedValueOnce([])

    render(<MatchDetailView backLink={backLink} />)

    expect(
      await screen.findByText('MatchDetailsMock')
    ).toBeInTheDocument()
    expect(
      screen.getByText('TeamsDisplayMock')
    ).toBeInTheDocument()
    expect(
      screen.queryByText('EditMatchCardMock')
    ).not.toBeInTheDocument()
  })

  it('shows admin controls when user is admin', async () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'admin1' },
      userData: { uid: 'admin1', position: 'ST' },
    })
    useAdminMock.mockReturnValue({ isAdmin: true })

    getMatchMock.mockResolvedValueOnce({
      id: 'match1',
      date: new Date(),
      time: '19:00',
      location: null,
      rsvpOpen: true,
      rsvpOpenAt: null,
      rsvpCloseAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    getMatchRSVPsMock.mockResolvedValueOnce([])
    getMatchTeamsMock.mockResolvedValueOnce([
      {
        id: 't1',
        matchId: 'match1',
        teamNumber: 1,
        name: 'Team 1',
        color: 'red',
        playerIds: [],
        maxSize: 11,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 't2',
        matchId: 'match1',
        teamNumber: 2,
        name: 'Team 2',
        color: 'blue',
        playerIds: [],
        maxSize: 11,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    getAllUsersMock.mockResolvedValueOnce([])

    render(<MatchDetailView backLink={backLink} />)

    await screen.findByText('MatchDetailsMock')

    expect(screen.getByText('EditMatchCardMock')).toBeInTheDocument()
    expect(screen.getByText('ImpersonateRSVPMock')).toBeInTheDocument()
    expect(screen.getByText('TeamsDisplayMock')).toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen.getByText('PlayerTransferMock')
      ).toBeInTheDocument()
    })
  })
})

