import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClubAdminRoster } from './ClubAdminRoster'
import { listClubMembersAPI } from '@/lib/api/client'

vi.mock('@/lib/api/client', () => ({
  listClubMembersAPI: vi.fn(),
  updateClubMemberRoleAPI: vi.fn(),
}))

describe('ClubAdminRoster', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listClubMembersAPI).mockResolvedValue({
      success: true,
      members: [
        {
          id: 'm1',
          clubId: 'c1',
          userId: 'u1',
          role: 'club_admin',
          status: 'active',
          joinedAt: new Date(),
          updatedAt: new Date(),
          displayName: 'Admin Self',
          email: 'a@example.com',
        },
        {
          id: 'm2',
          clubId: 'c1',
          userId: 'u2',
          role: 'player',
          status: 'active',
          joinedAt: new Date(),
          updatedAt: new Date(),
          displayName: 'Player Two',
          email: 'p@example.com',
        },
      ],
    })
  })

  it('lists members with role controls', async () => {
    render(<ClubAdminRoster clubId="c1" currentUserId="u1" />)

    expect(await screen.findByText('Admin Self (you)')).toBeInTheDocument()
    expect(screen.getByText('Player Two')).toBeInTheDocument()
    expect(listClubMembersAPI).toHaveBeenCalledWith('c1')
    expect(screen.getByLabelText('Role for Admin Self')).toBeDisabled()
    expect(screen.getByLabelText('Role for Player Two')).not.toBeDisabled()
  })

  it('shows an error when the roster fails to load', async () => {
    vi.mocked(listClubMembersAPI).mockRejectedValue(new Error('Nope'))
    render(<ClubAdminRoster clubId="c1" currentUserId="u1" />)
    expect(await screen.findByText('Nope')).toBeInTheDocument()
  })
})
