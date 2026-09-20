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
      loading: false,
    })
    useAdminMock.mockReturnValue({ isAdmin: false })
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
})
