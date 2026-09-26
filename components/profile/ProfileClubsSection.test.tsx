import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileClubsSection } from './ProfileClubsSection'
import { redeemInviteAPI } from '@/lib/api/client'

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

const refreshMock = vi.fn()
const afterInviteRedeemedMock = vi.fn()
const useClubMembershipsMock = vi.fn()
vi.mock('@/lib/hooks/useClubMemberships', () => ({
  useClubMemberships: () => useClubMembershipsMock(),
  afterInviteRedeemed: (...args: unknown[]) => afterInviteRedeemedMock(...args),
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
    useClubMembershipsMock.mockReturnValue({
      memberships: [],
      loading: false,
      error: null,
      refresh: refreshMock,
    })
  })

  it('shows join-by-code form when the user has no memberships', () => {
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

  it('redeems an invite code and refreshes memberships', async () => {
    const user = userEvent.setup()
    vi.mocked(redeemInviteAPI).mockResolvedValue({
      clubId: 'club-a',
      alreadyMember: false,
    } as never)

    render(<ProfileClubsSection />)

    await user.type(screen.getByLabelText('Invite code'), 'abcd12')
    await user.click(screen.getByRole('button', { name: 'Join club' }))

    await waitFor(() => {
      expect(redeemInviteAPI).toHaveBeenCalledWith('ABCD12')
    })
    expect(afterInviteRedeemedMock).toHaveBeenCalledWith({
      uid: 'u1',
      clubId: 'club-a',
      alreadyMember: false,
    })
    expect(refreshMock).toHaveBeenCalled()
    expect(
      await screen.findByText('Joined club successfully.')
    ).toBeInTheDocument()
  })
})
