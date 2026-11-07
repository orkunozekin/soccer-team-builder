import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClubRosterPage from './page'
import { getClubSkillRankingAPI } from '@/lib/api/client'

const flagMock = vi.fn((key: string) => key === '__none__')

vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'club-one' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  notFound: vi.fn(),
}))

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'admin-1' } }),
}))

vi.mock('@/lib/hooks/useClubSectionAccess', () => ({
  useClubSectionAccess: () => ({
    status: 'ok',
    club: { id: 'c1', name: 'Club One', slug: 'club-one', settings: {} },
  }),
}))

vi.mock('@/lib/flags/useFeatureFlag', () => ({
  useFeatureFlag: (key: string) => flagMock(key),
  useFeatureFlagReady: () => true,
}))

vi.mock('@/components/club/ClubAdminRoster', () => ({
  ClubAdminRoster: ({ clubId }: { clubId: string }) => (
    <div>Roster for {clubId}</div>
  ),
}))

vi.mock('@/lib/api/client', () => ({
  getClubSkillRankingAPI: vi.fn(),
  saveClubSkillRankingAPI: vi.fn(),
}))

describe('ClubRosterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    flagMock.mockImplementation(() => false)
    vi.mocked(getClubSkillRankingAPI).mockResolvedValue({
      ranking: { ratings: { u1: 7 }, version: 1 },
      members: [{ userId: 'u1', displayName: 'Alice', position: null }],
    })
  })

  it('renders only the roster when skill-balanced-teams is off', () => {
    render(<ClubRosterPage />)

    expect(screen.getByText('Roster for c1')).toBeInTheDocument()
    expect(screen.queryByText('Player ratings')).not.toBeInTheDocument()
    expect(getClubSkillRankingAPI).not.toHaveBeenCalled()
  })

  it('renders the ranking board below the roster when the flag is on', async () => {
    flagMock.mockImplementation(key => key === 'skill-balanced-teams')
    render(<ClubRosterPage />)

    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(getClubSkillRankingAPI).toHaveBeenCalledWith('c1')
    const roster = screen.getByText('Roster for c1')
    const board = screen.getByText('Player ratings')
    expect(
      roster.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
})
