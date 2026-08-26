import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RSVPPollControls } from './RSVPPollControls'
import type { Match } from '@/types/match'

const storeState = vi.hoisted(() => ({
  updateMatch: vi.fn(),
}))

vi.mock('@/store/matchStore', () => ({
  useMatchStore: () => storeState,
}))

const mocks = vi.hoisted(() => {
  const updateMatchAPIMock = vi.fn()
  const getRSVPScheduleMock = vi.fn(() => ({
    openAt: new Date('2024-01-01T09:00:00-06:00'),
    closeAt: new Date('2024-01-01T22:00:00-06:00'),
  }))
  return { updateMatchAPIMock, getRSVPScheduleMock }
})

vi.mock('@/lib/api/client', () => ({
  updateMatchAPI: (...args: unknown[]) => mocks.updateMatchAPIMock(...args),
}))

vi.mock('@/lib/utils/rsvpScheduler', () => ({
  getRSVPSchedule: (...args: unknown[]) =>
    mocks.getRSVPScheduleMock(...(args as [])),
}))

const baseMatch: Match = {
  id: 'match1',
  date: new Date('2024-01-01T19:00:00Z'),
  time: '19:00',
  location: { name: 'Test field', address: 'Test field', lat: 30.0, lng: -97.0 },
  rsvpOpen: true,
  rsvpOpenAt: null,
  rsvpCloseAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('RSVPPollControls', () => {
  it('shows current RSVP status and disables appropriate buttons', () => {
    render(<RSVPPollControls match={baseMatch} />)

    expect(screen.getByText(/current status/i)).toBeInTheDocument()
    expect(screen.getByText(content => content === 'Open')).toBeInTheDocument()

    const openButton = screen.getByRole('button', { name: /open rsvp/i })
    const closeButton = screen.getByRole('button', { name: /close rsvp/i })

    expect(openButton).toBeDisabled()
    expect(closeButton).not.toBeDisabled()
  })

  it('opens RSVP when currently closed', async () => {
    const user = userEvent.setup()
    const onUpdated = vi.fn()
    const closedMatch: Match = { ...baseMatch, rsvpOpen: false }

    render(<RSVPPollControls match={closedMatch} onUpdated={onUpdated} />)

    const openButton = screen.getByRole('button', { name: /open rsvp/i })
    await user.click(openButton)

    expect(mocks.updateMatchAPIMock).toHaveBeenCalledWith(
      'match1',
      expect.objectContaining({ rsvpOpen: true })
    )
    expect(storeState.updateMatch).toHaveBeenCalledWith(
      'match1',
      expect.objectContaining({ rsvpOpen: true })
    )
    expect(onUpdated).toHaveBeenCalled()
    expect(
      screen.getByText(/rsvp status updated successfully/i)
    ).toBeInTheDocument()
  })

  it('closes RSVP when currently open', async () => {
    const user = userEvent.setup()
    const onUpdated = vi.fn()

    render(<RSVPPollControls match={baseMatch} onUpdated={onUpdated} />)

    const closeButton = screen.getByRole('button', { name: /close rsvp/i })
    await user.click(closeButton)

    expect(mocks.updateMatchAPIMock).toHaveBeenCalledWith('match1', {
      rsvpOpen: false,
    })
    expect(storeState.updateMatch).toHaveBeenCalledWith('match1', {
      rsvpOpen: false,
    })
    expect(onUpdated).toHaveBeenCalled()
  })
})
