import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileClubsSection } from './ProfileClubsSection'

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'u1' },
    userData: { uid: 'u1', activeClubId: null },
  }),
}))

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (s: { setUserData: () => void }) => unknown) =>
    selector({ setUserData: vi.fn() }),
}))

const useClubMembershipsMock = vi.fn()
vi.mock('@/lib/hooks/useClubMemberships', () => ({
  useClubMemberships: () => useClubMembershipsMock(),
}))

vi.mock('@/components/profile/ClubAdminRoster', () => ({
  ClubAdminRoster: () => <div>ClubAdminRosterMock</div>,
}))

vi.mock('@/lib/api/client', () => ({
  createClubInviteAPI: vi.fn(),
  updateClubAPI: vi.fn(),
  updateProfileAPI: vi.fn(),
  redeemInviteAPI: vi.fn(),
}))

describe('ProfileClubsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows join-by-code form when the user has no memberships', () => {
    useClubMembershipsMock.mockReturnValue({
      memberships: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<ProfileClubsSection />)

    expect(screen.getByLabelText('Invite code')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Join club' })
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'join page' })).toHaveAttribute(
      'href',
      '/join'
    )
  })
})
