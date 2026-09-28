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

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, title }: { value: string; title?: string }) => (
    <svg role="img" aria-label={title} data-value={value}>
      <title>{title}</title>
    </svg>
  ),
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
    expect(screen.getByRole('img', { name: 'Invite QR code' })).toHaveAttribute(
      'data-value',
      'http://localhost/join?code=ABCD12'
    )
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
    expect(
      screen.getByRole('button', { name: 'Copy link' })
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Revoke' }))

    await waitFor(() => {
      expect(revokeClubInviteAPI).toHaveBeenCalledWith('c1', 'i1')
    })
  })

  it('copies the invite URL from an active invite row', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
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
          link: 'https://app.example/join?code=ZZZZ99',
        },
      ],
    })

    render(<ClubInvitesPanel clubId="c1" canManageInvites />)

    await user.click(await screen.findByRole('button', { name: 'Copy link' }))

    expect(writeText).toHaveBeenCalledWith(
      'https://app.example/join?code=ZZZZ99'
    )
    expect(
      await screen.findByRole('button', { name: 'Copied' })
    ).toBeInTheDocument()
  })

  it('copies a relative invite path as an absolute URL', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    vi.mocked(listClubInvitesAPI).mockResolvedValue({
      success: true,
      invites: [
        {
          id: 'i1',
          clubId: 'c1',
          code: 'REL001',
          createdBy: 'u1',
          createdByRole: 'club_admin',
          useCount: 0,
          maxUses: null,
          expiresAt: null,
          revokedAt: null,
          createdAt: new Date(),
          link: '/join?code=REL001',
        },
      ],
    })

    render(<ClubInvitesPanel clubId="c1" canManageInvites />)

    await user.click(await screen.findByRole('button', { name: 'Copy link' }))

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/join?code=REL001`
    )
  })

  it('does not clear busy state for a newer revoke when an older one finishes', async () => {
    const user = userEvent.setup()
    let resolveFirst!: (value: { success: boolean }) => void
    let resolveSecond!: (value: { success: boolean }) => void
    vi.mocked(listClubInvitesAPI).mockResolvedValue({
      success: true,
      invites: [
        {
          id: 'i1',
          clubId: 'c1',
          code: 'AAA111',
          createdBy: 'u1',
          createdByRole: 'club_admin',
          useCount: 0,
          maxUses: null,
          expiresAt: null,
          revokedAt: null,
          createdAt: new Date(),
          link: '/join?code=AAA111',
        },
        {
          id: 'i2',
          clubId: 'c1',
          code: 'BBB222',
          createdBy: 'u1',
          createdByRole: 'club_admin',
          useCount: 0,
          maxUses: null,
          expiresAt: null,
          revokedAt: null,
          createdAt: new Date(),
          link: '/join?code=BBB222',
        },
      ],
    })
    vi.mocked(revokeClubInviteAPI).mockImplementation(
      (_clubId: string, inviteId: string) => {
        if (inviteId === 'i1') {
          return new Promise(resolve => {
            resolveFirst = resolve
          })
        }
        return new Promise(resolve => {
          resolveSecond = resolve
        })
      }
    )

    render(<ClubInvitesPanel clubId="c1" canManageInvites />)
    expect(await screen.findByText('AAA111')).toBeInTheDocument()

    const revokeButtons = screen.getAllByRole('button', { name: 'Revoke' })
    await user.click(revokeButtons[0])
    await user.click(revokeButtons[1])

    await waitFor(() => {
      expect(revokeClubInviteAPI).toHaveBeenCalledTimes(2)
    })
    expect(screen.getByRole('button', { name: '…' })).toBeDisabled()

    resolveFirst({ success: true })
    await waitFor(() => {
      expect(screen.queryByText('AAA111')).not.toBeInTheDocument()
    })
    // First revoke finishing must leave the second invite's busy state intact.
    expect(screen.getByRole('button', { name: '…' })).toBeDisabled()
    expect(screen.getByText('BBB222')).toBeInTheDocument()

    resolveSecond({ success: true })
    await waitFor(() => {
      expect(screen.queryByText('BBB222')).not.toBeInTheDocument()
    })
  })

  it('keeps a created invite when the list refresh fails', async () => {
    const user = userEvent.setup()
    vi.mocked(listClubInvitesAPI).mockResolvedValue({
      success: true,
      invites: [
        {
          id: 'i0',
          clubId: 'c1',
          code: 'OLD999',
          createdBy: 'u1',
          createdByRole: 'club_admin',
          useCount: 0,
          maxUses: null,
          expiresAt: null,
          revokedAt: null,
          createdAt: new Date(),
          link: '/join?code=OLD999',
        },
      ],
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
    expect(await screen.findByText('OLD999')).toBeInTheDocument()

    vi.mocked(listClubInvitesAPI).mockRejectedValueOnce(
      new Error('List failed')
    )
    await user.click(screen.getByRole('button', { name: 'Create invite' }))

    expect(await screen.findByText('NEW123')).toBeInTheDocument()
    expect(
      await screen.findByText(/Invite created, but failed to refresh the list/i)
    ).toBeInTheDocument()
    // Existing list preserved (not cleared) so revoke controls stay available.
    expect(screen.getByText('OLD999')).toBeInTheDocument()
  })

  it('ignores a stale initial list response after a newer refresh', async () => {
    const user = userEvent.setup()
    const freshInvite = {
      id: 'i-new',
      clubId: 'c1',
      code: 'FRESH1',
      createdBy: 'u1',
      createdByRole: 'club_admin' as const,
      useCount: 0,
      maxUses: null,
      expiresAt: null,
      revokedAt: null,
      createdAt: new Date(),
      link: '/join?code=FRESH1',
    }
    const staleInvite = {
      id: 'i-stale',
      clubId: 'c1',
      code: 'STALE0',
      createdBy: 'u1',
      createdByRole: 'club_admin' as const,
      useCount: 0,
      maxUses: null,
      expiresAt: null,
      revokedAt: null,
      createdAt: new Date(),
      link: '/join?code=STALE0',
    }

    let resolveInitial!: (value: {
      success: boolean
      invites: (typeof staleInvite)[]
    }) => void
    let listCalls = 0
    vi.mocked(listClubInvitesAPI).mockImplementation(() => {
      listCalls += 1
      if (listCalls === 1) {
        return new Promise(resolve => {
          resolveInitial = resolve
        })
      }
      return Promise.resolve({ success: true, invites: [freshInvite] })
    })
    vi.mocked(createClubInviteAPI).mockResolvedValue({
      success: true,
      invite: freshInvite,
      link: freshInvite.link,
    })

    render(<ClubInvitesPanel clubId="c1" canManageInvites />)
    expect(screen.getByText(/Loading invites/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Create invite' }))
    await waitFor(() => {
      expect(createClubInviteAPI).toHaveBeenCalled()
    })
    expect(await screen.findAllByText('FRESH1')).not.toHaveLength(0)

    resolveInitial({ success: true, invites: [staleInvite] })

    await waitFor(() => {
      expect(screen.getAllByText('FRESH1').length).toBeGreaterThan(0)
    })
    expect(screen.queryByText('STALE0')).not.toBeInTheDocument()
  })
})
