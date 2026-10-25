import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClubAdminRoster } from './ClubAdminRoster'
import { listClubMembersAPI, updateClubMemberRoleAPI } from '@/lib/api/client'

vi.mock('@/lib/api/client', () => ({
  listClubMembersAPI: vi.fn(),
  updateClubMemberRoleAPI: vi.fn(),
}))

describe('ClubAdminRoster', () => {
  beforeAll(() => {
    Object.assign(HTMLElement.prototype, {
      hasPointerCapture: () => false,
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
      scrollIntoView: () => {},
    })
  })

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

    expect(await screen.findByText('Admin Self')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Player Two')).toBeInTheDocument()
    expect(listClubMembersAPI).toHaveBeenCalledWith('c1')
    expect(screen.getByLabelText('Role for Admin Self')).toBeDisabled()
    expect(screen.getByLabelText('Role for Player Two')).not.toBeDisabled()
  })

  it('ignores a stale roster response after clubId changes', async () => {
    let resolveFirst!: (value: { success: boolean; members: never[] }) => void
    const first = new Promise<{ success: boolean; members: never[] }>(
      resolve => {
        resolveFirst = resolve
      }
    )
    vi.mocked(listClubMembersAPI)
      .mockImplementationOnce(() => first as never)
      .mockResolvedValueOnce({
        success: true,
        members: [
          {
            id: 'm2',
            clubId: 'c2',
            userId: 'u2',
            role: 'player',
            status: 'active',
            joinedAt: new Date(),
            updatedAt: new Date(),
            displayName: 'Club Two Member',
            email: 'two@example.com',
          },
        ],
      })

    const { rerender } = render(
      <ClubAdminRoster clubId="c1" currentUserId="u1" />
    )
    rerender(<ClubAdminRoster clubId="c2" currentUserId="u1" />)

    expect(await screen.findByText('Club Two Member')).toBeInTheDocument()
    resolveFirst({ success: true, members: [] })
    await waitFor(() => {
      expect(screen.getByText('Club Two Member')).toBeInTheDocument()
    })
    expect(screen.queryByText('Admin Self')).not.toBeInTheDocument()
  })

  it('paginates the roster 10 members at a time', async () => {
    vi.mocked(listClubMembersAPI).mockResolvedValue({
      success: true,
      members: Array.from({ length: 23 }, (_, i) => ({
        id: `m${i}`,
        clubId: 'c1',
        userId: `u${i}`,
        role: i === 0 ? ('club_admin' as const) : ('player' as const),
        status: 'active' as const,
        joinedAt: new Date(),
        updatedAt: new Date(),
        displayName: `Member ${String(i + 1).padStart(2, '0')}`,
        email: `m${i}@example.com`,
      })),
    })
    render(<ClubAdminRoster clubId="c1" currentUserId="u0" />)

    expect(await screen.findByText('Member 01')).toBeInTheDocument()
    expect(screen.getByText('Member 10')).toBeInTheDocument()
    expect(screen.queryByText('Member 11')).not.toBeInTheDocument()
    expect(screen.getByText('23 members')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Go to previous page' })
    ).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }))
    expect(screen.getByText('Member 11')).toBeInTheDocument()
    expect(screen.queryByText('Member 01')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Go to page 2' })
    ).toHaveAttribute('aria-current', 'page')

    fireEvent.click(screen.getByRole('button', { name: 'Go to page 3' }))
    expect(screen.getByText('Member 23')).toBeInTheDocument()
    expect(screen.queryByText('Member 20')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Go to next page' })
    ).toBeDisabled()
  })

  it('follows a member onto their new page after a role change', async () => {
    const user = userEvent.setup()
    vi.mocked(updateClubMemberRoleAPI).mockResolvedValue({
      success: true,
      membership: { id: 'm22', role: 'club_admin' },
    })
    vi.mocked(listClubMembersAPI).mockResolvedValue({
      success: true,
      members: Array.from({ length: 23 }, (_, i) => ({
        id: `m${i}`,
        clubId: 'c1',
        userId: `u${i}`,
        role: i === 0 ? ('club_admin' as const) : ('player' as const),
        status: 'active' as const,
        joinedAt: new Date(),
        updatedAt: new Date(),
        displayName: `Member ${String(i + 1).padStart(2, '0')}`,
        email: `m${i}@example.com`,
      })),
    })
    render(<ClubAdminRoster clubId="c1" currentUserId="u0" />)

    expect(await screen.findByText('Member 01')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 3' }))
    expect(screen.getByText('Member 23')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Role for Member 23'))
    await user.click(await screen.findByRole('option', { name: 'Club admin' }))

    expect(await screen.findByText('Member 23')).toBeInTheDocument()
    expect(screen.getByText('Member 01')).toBeInTheDocument()
    expect(screen.queryByText('Member 21')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Go to page 1' })
    ).toHaveAttribute('aria-current', 'page')
  })

  it('hides pagination when the roster fits on one page', async () => {
    render(<ClubAdminRoster clubId="c1" currentUserId="u1" />)
    expect(await screen.findByText('Player Two')).toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Pagination' })
    ).not.toBeInTheDocument()
  })

  it('shows an error when the roster fails to load', async () => {
    vi.mocked(listClubMembersAPI).mockRejectedValue(new Error('Nope'))
    render(<ClubAdminRoster clubId="c1" currentUserId="u1" />)
    expect(await screen.findByText('Nope')).toBeInTheDocument()
  })

  it('filters the roster to club admins', async () => {
    const user = userEvent.setup()
    render(<ClubAdminRoster clubId="c1" currentUserId="u1" />)

    expect(await screen.findByText('Player Two')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Club admins' }))

    expect(screen.getByText('Admin Self')).toBeInTheDocument()
    expect(screen.queryByText('Player Two')).not.toBeInTheDocument()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Club admins' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('searches members by name or email', async () => {
    const user = userEvent.setup()
    render(<ClubAdminRoster clubId="c1" currentUserId="u1" />)

    expect(await screen.findByText('Player Two')).toBeInTheDocument()
    await user.type(
      screen.getByRole('textbox', { name: 'Search members' }),
      'p@example'
    )

    expect(screen.getByText('Player Two')).toBeInTheDocument()
    expect(screen.queryByText('Admin Self')).not.toBeInTheDocument()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
  })

  it('shows an empty match state when filters exclude everyone', async () => {
    const user = userEvent.setup()
    render(<ClubAdminRoster clubId="c1" currentUserId="u1" />)

    expect(await screen.findByText('Player Two')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Players' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Search members' }),
      'nobody'
    )

    expect(screen.getByText('No members match.')).toBeInTheDocument()
  })

  it('resets to page 1 when the role filter changes', async () => {
    const user = userEvent.setup()
    vi.mocked(listClubMembersAPI).mockResolvedValue({
      success: true,
      members: Array.from({ length: 12 }, (_, i) => ({
        id: `m${i}`,
        clubId: 'c1',
        userId: `u${i}`,
        role: i < 2 ? ('club_admin' as const) : ('player' as const),
        status: 'active' as const,
        joinedAt: new Date(),
        updatedAt: new Date(),
        displayName: `Member ${String(i + 1).padStart(2, '0')}`,
        email: `m${i}@example.com`,
      })),
    })
    render(<ClubAdminRoster clubId="c1" currentUserId="u0" />)

    expect(await screen.findByText('Member 01')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }))
    expect(screen.getByText('Member 11')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Players' }))
    expect(screen.getByText('Member 03')).toBeInTheDocument()
    expect(screen.queryByText('Member 01')).not.toBeInTheDocument()
    expect(screen.getByText('10 of 12')).toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Pagination' })
    ).not.toBeInTheDocument()
  })

  it('keeps the live filter page after a delayed role change', async () => {
    const user = userEvent.setup()
    let resolveRole!: (value: {
      success: boolean
      membership: { id: string; role: 'player' }
    }) => void
    const pending = new Promise<{
      success: boolean
      membership: { id: string; role: 'player' }
    }>(resolve => {
      resolveRole = resolve
    })
    vi.mocked(updateClubMemberRoleAPI).mockReturnValue(pending as never)
    vi.mocked(listClubMembersAPI).mockResolvedValue({
      success: true,
      members: [
        ...Array.from({ length: 25 }, (_, i) => ({
          id: `a${i}`,
          clubId: 'c1',
          userId: `admin-${i}`,
          role: 'club_admin' as const,
          status: 'active' as const,
          joinedAt: new Date(),
          updatedAt: new Date(),
          displayName: `Admin ${String(i + 1).padStart(2, '0')}`,
          email: `admin${i}@example.com`,
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `p${i}`,
          clubId: 'c1',
          userId: `player-${i}`,
          role: 'player' as const,
          status: 'active' as const,
          joinedAt: new Date(),
          updatedAt: new Date(),
          displayName: `Player ${String(i + 1).padStart(2, '0')}`,
          email: `player${i}@example.com`,
        })),
      ],
    })
    render(<ClubAdminRoster clubId="c1" currentUserId="admin-0" />)

    expect(await screen.findByText('Admin 01')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 2' }))
    expect(screen.getByText('Admin 15')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Role for Admin 15'))
    await user.click(await screen.findByRole('option', { name: 'Player' }))

    await user.click(screen.getByRole('button', { name: 'Club admins' }))
    expect(screen.getByText('Admin 01')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Go to page 1' })
    ).toHaveAttribute('aria-current', 'page')

    resolveRole({
      success: true,
      membership: { id: 'a14', role: 'player' },
    })

    await waitFor(() => {
      expect(screen.queryByText('Admin 15')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Admin 01')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Go to page 1' })
    ).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('24 of 30')).toBeInTheDocument()
  })
})
