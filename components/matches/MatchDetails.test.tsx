import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MatchDetails } from './MatchDetails'
import type { Match } from '@/types/match'
import type { RSVP } from '@/types/rsvp'

const storeState = vi.hoisted(() => ({
  updateRSVPPosition: vi.fn(),
}))

vi.mock('@/store/matchStore', () => ({
  useMatchStore: () => storeState,
}))

const updateRSVPPositionAPIMock = vi.fn()

vi.mock('@/lib/api/client', () => ({
  updateRSVPPositionAPI: (...args: unknown[]) =>
    updateRSVPPositionAPIMock(...args),
}))

vi.mock('@/components/matches/RSVPButton', () => ({
  RSVPButton: () => <div>RSVPButtonMock</div>,
}))

vi.mock('@/components/profile/PositionSelector', () => ({
  PositionSelector: (props: { onValueChange: (v: string | null) => void }) => (
    <button onClick={() => props.onValueChange('ST')}>Change position</button>
  ),
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

describe('MatchDetails', () => {
  it('renders basic match info and RSVP button', () => {
    render(
      <MatchDetails
        match={baseMatch}
        rsvpCount={2}
        userRsvp={null}
        userProfilePosition={null}
      />
    )

    expect(screen.getByText(/current headcount/i)).toBeInTheDocument()
    expect(screen.getByText(/2 players confirmed/i)).toBeInTheDocument()
    expect(screen.getByText('RSVPButtonMock')).toBeInTheDocument()
  })

  it('shows position edit section when user has RSVP and match RSVP is open', () => {
    const userRsvp: RSVP = {
      id: 'r1',
      matchId: 'match1',
      userId: 'user1',
      status: 'confirmed',
      position: 'GK',
      rsvpAt: new Date(),
      updatedAt: new Date(),
    }

    render(
      <MatchDetails
        match={baseMatch}
        rsvpCount={1}
        userRsvp={userRsvp}
        userProfilePosition={null}
      />
    )

    expect(
      screen.getByText(/your position for this match/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/current:/i)).toBeInTheDocument()
  })

  it('saves updated position and shows swap message when swapOccurred', async () => {
    const user = userEvent.setup()
    const userRsvp: RSVP = {
      id: 'r1',
      matchId: 'match1',
      userId: 'user1',
      status: 'confirmed',
      position: 'GK',
      rsvpAt: new Date(),
      updatedAt: new Date(),
    }

    storeState.updateRSVPPosition.mockReset()
    updateRSVPPositionAPIMock.mockResolvedValueOnce({
      swapOccurred: true,
      otherPlayerDisplayName: 'Teammate',
      swapWithReplacedPlayer: false,
    })

    render(
      <MatchDetails
        match={baseMatch}
        rsvpCount={1}
        userRsvp={userRsvp}
        userProfilePosition={null}
      />
    )

    await user.click(screen.getByText(/change position/i))
    await user.click(screen.getByRole('button', { name: /update position/i }))

    expect(updateRSVPPositionAPIMock).toHaveBeenCalledWith('r1', 'ST')
    expect(storeState.updateRSVPPosition).toHaveBeenCalledWith('r1', 'ST')
    expect(
      screen.getByText(/you were swapped with teammate/i)
    ).toBeInTheDocument()
  })
})
