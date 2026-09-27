import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminMatchesPage from './page'

const replaceMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}))

const useAuthMock = vi.fn()
vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

const useAdminMock = vi.fn()
vi.mock('@/lib/hooks/useAdmin', () => ({
  useAdmin: () => useAdminMock(),
}))

vi.mock('@/components/matches/ClubMatchesView', () => ({
  ClubMatchesView: ({ clubId }: { clubId: string | null }) => (
    <div>AllClubsMatches:{String(clubId)}</div>
  ),
}))

describe('AdminMatchesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({
      user: { uid: 'user1' },
      loading: false,
    })
    useAdminMock.mockReturnValue({ isAdmin: true, rolePending: false })
  })

  it('sends super users to Matches with all-clubs scope', async () => {
    render(<AdminMatchesPage />)
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/matches?scope=all')
    })
    expect(screen.queryByText('AllClubsMatches:null')).not.toBeInTheDocument()
  })

  it('waits for the user role before sending someone away', async () => {
    useAdminMock.mockReturnValue({ isAdmin: false, rolePending: true })
    render(<AdminMatchesPage />)
    expect(screen.queryByText('AllClubsMatches:null')).not.toBeInTheDocument()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('sends non-admins to /matches', async () => {
    useAdminMock.mockReturnValue({ isAdmin: false, rolePending: false })
    render(<AdminMatchesPage />)
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/matches')
    })
    expect(screen.queryByText('AllClubsMatches:null')).not.toBeInTheDocument()
  })
})
