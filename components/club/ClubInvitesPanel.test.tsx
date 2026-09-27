import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClubInvitesPanel } from './ClubInvitesPanel'
import {
  createClubInviteAPI,
  listClubInvitesAPI,
  revokeClubInviteAPI,
} from '@/lib/api/client'

vi.mock('@/lib/api/client', () => ({
  createClubInviteAPI: vi.fn(),
  listClubInvitesAPI: vi.fn(),
  revokeClubInviteAPI: vi.fn(),
}))

describe('ClubInvitesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates an invite for players without listing active invites', async () => {
    const user = userEvent.setup()
    vi.mocked(createClubInviteAPI).mockResolvedValue({
      success: true,
      invite: {
        id: 'i1',
        clubId: 'c1',
        code: 'ABCD12',
        createdBy: 'u1',
        createdByRole: 'player',
        useCount: 0,
        maxUses: null,
        expiresAt: null,
        revokedAt: null,
        createdAt: new Date(),
      },
      link: 'http://localhost/join?code=ABCD12',
    })

    render(<ClubInvitesPanel clubId="c1" canManageInvites={false} />)

    expect(listClubInvitesAPI).not.toHaveBeenCalled()
    expect(screen.queryByText(/active invites/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create invite' }))

    expect(await screen.findByText('ABCD12')).toBeInTheDocument()
    expect(createClubInviteAPI).toHaveBeenCalledWith('c1')
  })

  it('lists and revokes invites for club admins', async () => {
    const user = userEvent.setup()
    vi.mocked(listClubInvitesAPI).mockResolvedValue({
      success: true,
      invites: [
        {
          id: 'i1',
          clubId: 'c1',
          code: 'ZZZZ99',
          createdBy: 'u1',
          createdByRole: 'club_admin',
          useCount: 1,
          maxUses: null,
          expiresAt: null,
          revokedAt: null,
          createdAt: new Date(),
          link: '/join?code=ZZZZ99',
        },
      ],
    })
    vi.mocked(revokeClubInviteAPI).mockResolvedValue({ success: true })

    render(<ClubInvitesPanel clubId="c1" canManageInvites />)

    expect(await screen.findByText('ZZZZ99')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Revoke' }))

    await waitFor(() => {
      expect(revokeClubInviteAPI).toHaveBeenCalledWith('c1', 'i1')
    })
  })

  it('keeps a created invite when the list refresh fails', async () => {
    const user = userEvent.setup()
    vi.mocked(listClubInvitesAPI).mockResolvedValue({
      success: true,
      invites: [],
    })
    vi.mocked(createClubInviteAPI).mockResolvedValue({
      success: true,
      invite: {
        id: 'i2',
        clubId: 'c1',
        code: 'NEW123',
        createdBy: 'u1',
        createdByRole: 'club_admin',
        useCount: 0,
        maxUses: null,
        expiresAt: null,
        revokedAt: null,
        createdAt: new Date(),
      },
      link: '/join?code=NEW123',
    })

    render(<ClubInvitesPanel clubId="c1" canManageInvites />)
    await screen.findByText(/no active invites/i)

    vi.mocked(listClubInvitesAPI).mockRejectedValueOnce(
      new Error('List failed')
    )
    await user.click(screen.getByRole('button', { name: 'Create invite' }))

    expect(await screen.findByText('NEW123')).toBeInTheDocument()
    expect(
      await screen.findByText(/Invite created, but failed to refresh the list/i)
    ).toBeInTheDocument()
  })
})
