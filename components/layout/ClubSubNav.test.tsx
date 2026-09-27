import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClubSubNav } from './ClubSubNav'
import { updateProfileAPI } from '@/lib/api/client'
import type { ClubMembershipWithClub } from '@/types/club'

const pushMock = vi.fn()
const setUserDataMock = vi.fn()
const useAuthMock = vi.fn()
const useAdminMock = vi.fn()
const useClubMembershipsMock = vi.fn()
const useFeatureFlagMock = vi.fn()
const usePathnameMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => usePathnameMock(),
}))

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/lib/hooks/useAdmin', () => ({
  useAdmin: () => useAdminMock(),
}))

vi.mock('@/lib/hooks/useClubMemberships', () => ({
  useClubMemberships: () => useClubMembershipsMock(),
}))

vi.mock('@/lib/hooks/useClubSlugAccess', () => ({
  useClubSlugAccess: () => ({ status: 'forbidden' }),
}))

vi.mock('@/lib/flags/useFeatureFlag', () => ({
  useFeatureFlag: (key: string) => useFeatureFlagMock(key),
}))

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (s: { setUserData: typeof setUserDataMock }) => unknown) =>
    selector({ setUserData: setUserDataMock }),
}))

vi.mock('@/lib/api/client', () => ({
  updateProfileAPI: vi.fn(),
}))

function membership(
  clubId: string,
  name: string,
  role: ClubMembershipWithClub['role'] = 'player'
): ClubMembershipWithClub {
  return {
    id: `${clubId}_u1`,
    clubId,
    userId: 'u1',
    role,
    status: 'active',
    joinedAt: new Date(),
    updatedAt: new Date(),
    club: {
      id: clubId,
      name,
      slug: clubId,
      settings: { allowPlayerInvites: false },
    },
  }
}

describe('ClubSubNav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePathnameMock.mockReturnValue('/matches')
    useAuthMock.mockReturnValue({
      user: { uid: 'u1' },
      userData: { uid: 'u1', activeClubId: 'alpha' },
      loading: false,
    })
    useAdminMock.mockReturnValue({ isSuperUser: false, isAdmin: false })
    useFeatureFlagMock.mockReturnValue(false)
    useClubMembershipsMock.mockReturnValue({
      memberships: [
        membership('alpha', 'Alpha FC'),
        membership('beta', 'Beta United', 'club_admin'),
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
  })

  it('returns null while auth is loading', () => {
    useAuthMock.mockReturnValue({
      user: null,
      userData: null,
      loading: true,
    })
    const { container } = render(<ClubSubNav />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a Join prompt when the user has no memberships', () => {
    useClubMembershipsMock.mockReturnValue({
      memberships: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
    render(<ClubSubNav />)
    expect(screen.getByText(/not in a club yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /join a club/i })).toHaveAttribute(
      'href',
      '/join'
    )
  })

  it('shows a load failure with retry instead of Join when memberships fail', async () => {
    const user = userEvent.setup()
    const refresh = vi.fn()
    useClubMembershipsMock.mockReturnValue({
      memberships: [],
      loading: false,
      error: 'Failed to load clubs',
      refresh,
    })
    render(<ClubSubNav />)
    expect(screen.getByText(/could not load clubs/i)).toBeInTheDocument()
    expect(screen.queryByText(/not in a club yet/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /try again/i }))
    expect(refresh).toHaveBeenCalled()
  })

  it('shows the current club and Matches on the sub-nav', () => {
    render(<ClubSubNav />)
    expect(screen.getByLabelText('Switch club')).toHaveTextContent('Alpha FC')
    expect(screen.getAllByRole('link', { name: 'Matches' })[0]).toHaveAttribute(
      'href',
      '/c/alpha/matches'
    )
  })

  it('shows roster, invites, and settings for club admins', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'u1' },
      userData: { uid: 'u1', activeClubId: 'beta' },
      loading: false,
    })
    usePathnameMock.mockReturnValue('/c/beta/matches')
    render(<ClubSubNav />)
    expect(screen.getAllByRole('link', { name: 'Roster' })[0]).toHaveAttribute(
      'href',
      '/c/beta/roster'
    )
    expect(screen.getAllByRole('link', { name: 'Invites' })[0]).toHaveAttribute(
      'href',
      '/c/beta/invites'
    )
    expect(
      screen.getAllByRole('link', { name: 'Settings' })[0]
    ).toHaveAttribute('href', '/c/beta/settings')
  })

  it('hides admin sections for players without invite permission', () => {
    render(<ClubSubNav />)
    expect(screen.queryByRole('link', { name: 'Roster' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Invites' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Settings' })
    ).not.toBeInTheDocument()
  })

  it('highlights Matches from the club slug path', () => {
    usePathnameMock.mockReturnValue('/c/alpha/matches')
    render(<ClubSubNav />)
    expect(screen.getAllByRole('link', { name: 'Matches' })[0]).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('uses the path slug club when it differs from activeClubId', () => {
    usePathnameMock.mockReturnValue('/c/beta/matches')
    render(<ClubSubNav />)
    expect(screen.getByLabelText('Switch club')).toHaveTextContent('Beta United')
    expect(screen.getAllByRole('link', { name: 'Matches' })[0]).toHaveAttribute(
      'href',
      '/c/beta/matches'
    )
  })

  it('does not show Create club when the flag is off', () => {
    useAdminMock.mockReturnValue({ isSuperUser: true, isAdmin: true })
    useFeatureFlagMock.mockReturnValue(false)
    render(<ClubSubNav />)
    expect(screen.queryByText('Create club')).not.toBeInTheDocument()
  })

  it('shows Create club for super users when club-creation is on', () => {
    useAdminMock.mockReturnValue({ isSuperUser: true, isAdmin: true })
    useFeatureFlagMock.mockImplementation(
      (key: string) => key === 'club-creation'
    )
    render(<ClubSubNav />)
    // Desktop menu item is inside the closed dropdown; open it.
    // Mobile link is also rendered (sm:hidden) in jsdom.
    expect(screen.getAllByText('Create club').length).toBeGreaterThan(0)
  })

  it('switches active club via PATCH /users/me', async () => {
    const user = userEvent.setup()
    vi.mocked(updateProfileAPI).mockResolvedValue({ success: true })

    render(<ClubSubNav />)
    await user.click(screen.getByLabelText('Switch club'))
    await user.click(screen.getByText('Beta United'))

    await waitFor(() => {
      expect(updateProfileAPI).toHaveBeenCalledWith({ activeClubId: 'beta' })
    })
    expect(setUserDataMock).toHaveBeenCalledWith(
      expect.objectContaining({ activeClubId: 'beta' })
    )
  })

  it('shows a user-facing error when club switch fails', async () => {
    const user = userEvent.setup()
    vi.mocked(updateProfileAPI).mockRejectedValue(new Error('Network down'))

    render(<ClubSubNav />)
    await user.click(screen.getByLabelText('Switch club'))
    await user.click(screen.getByText('Beta United'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Network down')
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('navigates to the new club matches path when switching off a club route', async () => {
    const user = userEvent.setup()
    usePathnameMock.mockReturnValue('/c/alpha/matches')
    vi.mocked(updateProfileAPI).mockResolvedValue({ success: true })

    render(<ClubSubNav />)
    await user.click(screen.getByLabelText('Switch club'))
    await user.click(screen.getByText('Beta United'))

    await waitFor(() => {
      expect(updateProfileAPI).toHaveBeenCalledWith({ activeClubId: 'beta' })
    })
    expect(pushMock).toHaveBeenCalledWith('/c/beta/matches')
  })

  it('lands on matches when switching to a club that cannot open roster', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue({
      user: { uid: 'u1' },
      userData: { uid: 'u1', activeClubId: 'beta' },
      loading: false,
    })
    usePathnameMock.mockReturnValue('/c/beta/roster')
    vi.mocked(updateProfileAPI).mockResolvedValue({ success: true })

    render(<ClubSubNav />)
    await user.click(screen.getByLabelText('Switch club'))
    await user.click(screen.getByText('Alpha FC'))

    await waitFor(() => {
      expect(updateProfileAPI).toHaveBeenCalledWith({ activeClubId: 'alpha' })
    })
    expect(pushMock).toHaveBeenCalledWith('/c/alpha/matches')
  })

  it('stays on profile when switching clubs from a platform page', async () => {
    const user = userEvent.setup()
    usePathnameMock.mockReturnValue('/profile')
    vi.mocked(updateProfileAPI).mockResolvedValue({ success: true })

    render(<ClubSubNav />)
    await user.click(screen.getByLabelText('Switch club'))
    await user.click(screen.getByText('Beta United'))

    await waitFor(() => {
      expect(updateProfileAPI).toHaveBeenCalledWith({ activeClubId: 'beta' })
    })
    expect(pushMock).not.toHaveBeenCalled()
  })
})
