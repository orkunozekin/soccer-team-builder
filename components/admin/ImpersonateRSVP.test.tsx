import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ImpersonateRSVP } from './ImpersonateRSVP'
import type { Match } from '@/types/match'
import type { RSVP } from '@/types/rsvp'

const mocks = vi.hoisted(() => ({
  confirmRSVPAPIMock: vi.fn(),
  cancelRSVPAPIMock: vi.fn(),
  searchUsersAPIMock: vi.fn(),
}))

vi.mock('@/lib/api/client', () => ({
  confirmRSVPAPI: (...args: unknown[]) => mocks.confirmRSVPAPIMock(...args),
  cancelRSVPAPI: (...args: unknown[]) => mocks.cancelRSVPAPIMock(...args),
  searchUsersAPI: (...args: unknown[]) => mocks.searchUsersAPIMock(...args),
}))

vi.mock('@/components/profile/PositionSelector', () => ({
  PositionSelector: () => <div>PositionSelectorMock</div>,
}))

const baseMatch: Match = {
  id: 'match1',
  date: new Date('2024-01-01T19:00:00Z'),
  time: '19:00',
  location: 'Test field',
  rsvpOpen: true,
  rsvpOpenAt: null,
  rsvpCloseAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('ImpersonateRSVP', () => {
  it('renders null when match RSVP is closed', () => {
    const closedMatch: Match = { ...baseMatch, rsvpOpen: false }
    const { container } = render(
      <ImpersonateRSVP match={closedMatch} matchRSVPs={[]} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('searches and RSVPs as a user without existing RSVP', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()

    mocks.searchUsersAPIMock.mockResolvedValueOnce({
      users: [
        {
          uid: 'u1',
          email: 'u1@example.com',
          displayName: 'User One',
          role: 'user',
        },
      ],
    })
    mocks.confirmRSVPAPIMock.mockResolvedValueOnce(undefined)

    render(
      <ImpersonateRSVP match={baseMatch} matchRSVPs={[]} onDone={onDone} />
    )

    const input = screen.getByLabelText(/search by name or email/i)
    await user.type(input, 'User')

    const resultButton = await screen.findByRole('button', {
      name: /user one/i,
    })
    await user.click(resultButton)

    await user.click(
      screen.getByRole('button', { name: /rsvp as this player/i })
    )

    expect(mocks.confirmRSVPAPIMock).toHaveBeenCalledWith(
      'match1',
      undefined,
      'u1'
    )
    expect(onDone).toHaveBeenCalled()
  })

  it('cancels an existing RSVP for a selected user', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()

    const rsvp: RSVP = {
      id: 'r1',
      matchId: 'match1',
      userId: 'u1',
      status: 'confirmed',
      position: null,
      rsvpAt: new Date(),
      updatedAt: new Date(),
    }

    mocks.searchUsersAPIMock.mockResolvedValueOnce({
      users: [
        {
          uid: 'u1',
          email: 'u1@example.com',
          displayName: 'User One',
          role: 'user',
        },
      ],
    })
    mocks.cancelRSVPAPIMock.mockResolvedValueOnce(undefined)

    render(
      <ImpersonateRSVP match={baseMatch} matchRSVPs={[rsvp]} onDone={onDone} />
    )

    const input = screen.getByLabelText(/search by name or email/i)
    await user.type(input, 'User')

    const resultButton = await screen.findByRole('button', {
      name: /user one/i,
    })
    await user.click(resultButton)

    await user.click(screen.getByRole('button', { name: /cancel rsvp/i }))

    expect(mocks.cancelRSVPAPIMock).toHaveBeenCalledWith('r1')
    expect(onDone).toHaveBeenCalled()
  })
})
