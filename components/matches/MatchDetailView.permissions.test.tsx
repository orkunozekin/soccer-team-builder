import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SWRConfig, unstable_serialize } from 'swr'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatchDetailView } from './MatchDetailView'
import { myClubsKey } from '@/lib/hooks/useClubMemberships'
import type { ClubMembershipWithClub } from '@/types/club'

const routerMock = { push: vi.fn() }

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useParams: () => ({ matchId: 'match1' }),
}))

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user1' },
    userData: { uid: 'user1', role: 'user' },
  }),
}))

const getMyClubsAPIMock = vi.fn()
vi.mock('@/lib/api/client', () => ({
  getMyClubsAPI: (...args: unknown[]) => getMyClubsAPIMock(...args),
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

vi.mock('@/lib/services/matchService', () => ({
  getMatch: vi.fn().mockResolvedValue({
    id: 'match1',
    clubId: 'club1',
    date: new Date('2026-10-27T00:00:00Z'),
    time: '19:00',
    location: null,
    rsvpOpen: false,
    rsvpOpenAt: null,
    rsvpCloseAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
}))

vi.mock('@/lib/services/rsvpService', () => ({
  getMatchRSVPs: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/services/teamService', () => ({
  getMatchTeams: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/services/userService', () => ({
  getUsersByIds: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/components/matches/MatchDetails', () => ({
  MatchDetails: () => <div>MatchDetailsMock</div>,
}))

vi.mock('@/components/admin/EditMatchCard', () => ({
  EditMatchCard: () => <div>EditMatchCardMock</div>,
}))

vi.mock('@/components/admin/ImpersonateRSVP', () => ({
  ImpersonateRSVP: () => <div>ImpersonateRSVPMock</div>,
}))

vi.mock('@/components/admin/RsvpOrderCard', () => ({
  RsvpOrderCard: () => <div>RsvpOrderCardMock</div>,
}))

vi.mock('@/components/teams/TeamsDisplay', () => ({
  TeamsDisplay: () => <div>TeamsDisplayMock</div>,
}))

function membership(role: 'player' | 'club_admin'): ClubMembershipWithClub {
  return {
    id: 'club1_user1',
    clubId: 'club1',
    userId: 'user1',
    role,
    status: 'active',
    joinedAt: new Date(),
    updatedAt: new Date(),
    club: {
      id: 'club1',
      name: 'Club One',
      slug: 'club-one',
      settings: { allowPlayerInvites: false },
    },
  }
}

function renderWithMembershipCache(cached?: ClubMembershipWithClub[]) {
  const cache = new Map<string, unknown>()
  if (cached) {
    cache.set(unstable_serialize(myClubsKey('user1')), cached)
  }

  return render(
    <SWRConfig
      value={{
        provider: () => cache,
        dedupingInterval: 0,
        errorRetryInterval: 1,
      }}
    >
      <MatchDetailView
        backLink={{ href: '/c/club-one/matches', label: 'Back to matches' }}
      />
    </SWRConfig>
  )
}

describe('MatchDetailView club permission recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matchStoreState.currentMatch = null
    matchStoreState.matchRSVPs = []
  })

  it('revalidates a cached player role and restores admin controls on mount', async () => {
    let resolveMemberships: (value: {
      success: boolean
      memberships: ClubMembershipWithClub[]
    }) => void = () => {}
    getMyClubsAPIMock.mockReturnValueOnce(
      new Promise(resolve => {
        resolveMemberships = resolve
      })
    )

    renderWithMembershipCache([membership('player')])

    expect(await screen.findByText('MatchDetailsMock')).toBeInTheDocument()
    expect(screen.queryByText('EditMatchCardMock')).not.toBeInTheDocument()

    await act(async () => {
      resolveMemberships({
        success: true,
        memberships: [membership('club_admin')],
      })
    })

    expect(await screen.findByText('EditMatchCardMock')).toBeInTheDocument()
    expect(getMyClubsAPIMock).toHaveBeenCalledTimes(1)
  })

  it('restores admin controls after one failed lookup retries successfully', async () => {
    getMyClubsAPIMock
      .mockRejectedValueOnce(new Error('Failed to load clubs'))
      .mockResolvedValueOnce({
        success: true,
        memberships: [membership('club_admin')],
      })

    renderWithMembershipCache()

    expect(await screen.findByText('EditMatchCardMock')).toBeInTheDocument()
    expect(getMyClubsAPIMock).toHaveBeenCalledTimes(2)
  })

  it('restores admin controls after the permission error retry is clicked', async () => {
    const user = userEvent.setup()
    getMyClubsAPIMock.mockRejectedValue(new Error('Failed to load clubs'))

    renderWithMembershipCache()

    expect(
      await screen.findByText(/couldn't verify your club permissions/i)
    ).toBeInTheDocument()
    await waitFor(() => expect(getMyClubsAPIMock).toHaveBeenCalledTimes(2))

    getMyClubsAPIMock.mockReset()
    getMyClubsAPIMock.mockResolvedValue({
      success: true,
      memberships: [membership('club_admin')],
    })
    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByText('EditMatchCardMock')).toBeInTheDocument()
    expect(getMyClubsAPIMock).toHaveBeenCalledTimes(1)
  })
})
