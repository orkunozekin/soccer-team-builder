import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'
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

// jsdom cannot follow real anchor navigation; keep Link clicks in-page.
vi.mock('next/link', async () => {
  const { forwardRef } = await import('react')
  const Link = forwardRef<
    HTMLAnchorElement,
    React.AnchorHTMLAttributes<HTMLAnchorElement>
  >(({ onClick, ...rest }, ref) => (
    <a
      ref={ref}
      onClick={event => {
        event.preventDefault()
        onClick?.(event)
      }}
      {...rest}
    />
  ))
  Link.displayName = 'Link'
  return { default: Link }
})

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
  useAuthStore: (
    selector: (s: { setUserData: typeof setUserDataMock }) => unknown
  ) => selector({ setUserData: setUserDataMock }),
}))

vi.mock('@/lib/api/client', () => ({
  updateProfileAPI: vi.fn(),
}))

vi.mock('@/lib/firebase/auth', () => ({
  logoutUser: vi.fn(),
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

/** Desktop rail (`aside`). jsdom renders both rail and mobile header. */
function rail() {
  return within(screen.getByRole('complementary'))
}

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePathnameMock.mockReturnValue('/c/alpha/matches')
    useAuthMock.mockReturnValue({
      user: { uid: 'u1', email: 'u1@example.com' },
      userData: { uid: 'u1', displayName: 'Pat Player', activeClubId: 'alpha' },
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

  it('shows only the centered brand when signed out', () => {
    useAuthMock.mockReturnValue({ user: null, userData: null, loading: false })
    render(
      <AppShell>
        <p>page</p>
      </AppShell>
    )
    expect(screen.getByText('Soccerville')).toBeInTheDocument()
    expect(screen.getByText('page')).toBeInTheDocument()
    expect(screen.queryByLabelText('Switch club')).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('renders page content next to the club rail', () => {
    render(
      <AppShell>
        <p>page</p>
      </AppShell>
    )
    expect(screen.getByText('page')).toBeInTheDocument()
    expect(rail().getByLabelText('Switch club')).toHaveTextContent('Alpha FC')
    expect(rail().getByRole('link', { name: 'Matches' })).toHaveAttribute(
      'href',
      '/c/alpha/matches'
    )
  })

  it('highlights the active club section', () => {
    render(<AppShell />)
    expect(rail().getByRole('link', { name: 'Matches' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('shows roster, invites, and settings for club admins', () => {
    usePathnameMock.mockReturnValue('/c/beta/roster')
    render(<AppShell />)
    expect(rail().getByLabelText('Switch club')).toHaveTextContent(
      'Beta United'
    )
    expect(rail().getByRole('link', { name: 'Roster' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(rail().getByRole('link', { name: 'Invites' })).toHaveAttribute(
      'href',
      '/c/beta/invites'
    )
    expect(rail().getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/c/beta/settings'
    )
  })

  it('hides admin sections for players without invite permission', () => {
    render(<AppShell />)
    expect(
      rail().queryByRole('link', { name: 'Roster' })
    ).not.toBeInTheDocument()
    expect(
      rail().queryByRole('link', { name: 'Invites' })
    ).not.toBeInTheDocument()
  })

  it('keeps account links out of club sections and in the account nav', () => {
    useAdminMock.mockReturnValue({ isSuperUser: true, isAdmin: true })
    usePathnameMock.mockReturnValue('/profile')
    render(<AppShell />)
    const clubNav = rail().getByRole('navigation', { name: 'Club sections' })
    expect(
      within(clubNav).queryByRole('link', { name: 'Profile' })
    ).not.toBeInTheDocument()
    const adminNav = rail().getByRole('navigation', { name: 'Admin sections' })
    expect(
      within(adminNav).getByRole('link', { name: 'All matches' })
    ).toHaveAttribute('href', '/admin/matches')
    expect(
      within(adminNav).getByRole('link', { name: 'Analytics' })
    ).toHaveAttribute('href', '/admin/analytics')
    expect(
      within(adminNav).getByRole('link', { name: 'Users' })
    ).toHaveAttribute('href', '/admin/users')
    expect(within(adminNav).queryByText('Admin')).not.toBeInTheDocument()
    expect(
      within(clubNav).queryByRole('link', { name: 'Analytics' })
    ).not.toBeInTheDocument()

    const accountNav = rail().getByRole('navigation', {
      name: 'Account sections',
    })
    expect(
      within(accountNav).getByRole('link', { name: 'Profile' })
    ).toHaveAttribute('href', '/profile')
    expect(
      within(accountNav).getByRole('link', { name: 'Profile' })
    ).toHaveAttribute('aria-current', 'page')
    expect(
      within(accountNav).getByRole('link', { name: 'My clubs' })
    ).toHaveAttribute('href', '/clubs')
    expect(
      within(accountNav).queryByRole('link', { name: 'Analytics' })
    ).not.toBeInTheDocument()
    expect(rail().getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('hides admin sections for non super users', () => {
    render(<AppShell />)
    expect(
      rail().queryByRole('navigation', { name: 'Admin sections' })
    ).not.toBeInTheDocument()
    expect(
      rail().getByRole('navigation', { name: 'Account sections' })
    ).toBeInTheDocument()
    expect(
      rail().queryByRole('link', { name: 'Analytics' })
    ).not.toBeInTheDocument()
  })

  it('opens club sections in a mobile sheet', async () => {
    const user = userEvent.setup()
    usePathnameMock.mockReturnValue('/c/beta/matches')
    render(<AppShell />)
    await user.click(screen.getByLabelText('Open club menu'))
    const sheet = within(screen.getByRole('dialog'))
    expect(sheet.getByRole('link', { name: 'Roster' })).toHaveAttribute(
      'href',
      '/c/beta/roster'
    )
    expect(
      sheet.getByRole('navigation', { name: 'Account sections' })
    ).toBeInTheDocument()
    expect(sheet.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    await user.click(sheet.getByRole('link', { name: 'Roster' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('closes the mobile sheet when joining a club from the empty state', async () => {
    const user = userEvent.setup()
    useClubMembershipsMock.mockReturnValue({
      memberships: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
    render(<AppShell />)
    await user.click(screen.getByLabelText('Open club menu'))
    const sheet = within(screen.getByRole('dialog'))
    await user.click(sheet.getByRole('link', { name: /join a club/i }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('shows a Join prompt when the user has no memberships', () => {
    useClubMembershipsMock.mockReturnValue({
      memberships: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
    render(<AppShell />)
    expect(rail().getByText(/not in a club yet/i)).toBeInTheDocument()
    expect(rail().getByRole('link', { name: /join a club/i })).toHaveAttribute(
      'href',
      '/join'
    )
    expect(rail().queryByLabelText('Switch club')).not.toBeInTheDocument()
  })

  it('shows a retryable error instead of Join when memberships fail', async () => {
    const user = userEvent.setup()
    const refresh = vi.fn()
    useClubMembershipsMock.mockReturnValue({
      memberships: [],
      loading: false,
      error: 'Failed to load clubs',
      refresh,
    })
    render(<AppShell />)
    expect(rail().getByText(/could not load clubs/i)).toBeInTheDocument()
    expect(rail().queryByText(/not in a club yet/i)).not.toBeInTheDocument()
    await user.click(rail().getByRole('button', { name: /try again/i }))
    expect(refresh).toHaveBeenCalled()
  })

  it('switches club via PATCH and navigates to the new club matches', async () => {
    const user = userEvent.setup()
    vi.mocked(updateProfileAPI).mockResolvedValue({ success: true })
    render(<AppShell />)
    await user.click(rail().getByLabelText('Switch club'))
    await user.click(screen.getByRole('button', { name: /beta united/i }))

    await waitFor(() => {
      expect(updateProfileAPI).toHaveBeenCalledWith({ activeClubId: 'beta' })
    })
    expect(setUserDataMock).toHaveBeenCalledWith(
      expect.objectContaining({ activeClubId: 'beta' })
    )
    expect(pushMock).toHaveBeenCalledWith('/c/beta/matches')
  })

  it('lands on matches when the new club role cannot open the section', async () => {
    const user = userEvent.setup()
    usePathnameMock.mockReturnValue('/c/beta/roster')
    vi.mocked(updateProfileAPI).mockResolvedValue({ success: true })
    render(<AppShell />)
    await user.click(rail().getByLabelText('Switch club'))
    await user.click(screen.getByRole('button', { name: /alpha fc/i }))

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/c/alpha/matches')
    })
  })

  it('stays on my clubs when switching from that page', async () => {
    const user = userEvent.setup()
    usePathnameMock.mockReturnValue('/clubs')
    vi.mocked(updateProfileAPI).mockResolvedValue({ success: true })
    render(<AppShell />)
    await user.click(rail().getByLabelText('Switch club'))
    await user.click(screen.getByRole('button', { name: /beta united/i }))

    await waitFor(() => {
      expect(updateProfileAPI).toHaveBeenCalledWith({ activeClubId: 'beta' })
    })
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('stays on profile when switching from a platform page', async () => {
    const user = userEvent.setup()
    usePathnameMock.mockReturnValue('/profile')
    vi.mocked(updateProfileAPI).mockResolvedValue({ success: true })
    render(<AppShell />)
    await user.click(rail().getByLabelText('Switch club'))
    await user.click(screen.getByRole('button', { name: /beta united/i }))

    await waitFor(() => {
      expect(updateProfileAPI).toHaveBeenCalledWith({ activeClubId: 'beta' })
    })
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('shows a user-facing error when club switch fails', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(updateProfileAPI).mockRejectedValue(new Error('Network down'))
    render(<AppShell />)
    await user.click(rail().getByLabelText('Switch club'))
    await user.click(screen.getByRole('button', { name: /beta united/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Network down')
    expect(pushMock).not.toHaveBeenCalled()
  })
})
