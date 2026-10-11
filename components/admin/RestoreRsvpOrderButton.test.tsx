import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RestoreRsvpOrderButton } from './RestoreRsvpOrderButton'

const mocks = vi.hoisted(() => ({
  generateTeamsAPIMock: vi.fn(),
}))

vi.mock('@/lib/api/client', () => ({
  generateTeamsAPI: (...args: unknown[]) => mocks.generateTeamsAPIMock(...args),
}))

describe('RestoreRsvpOrderButton', () => {
  beforeEach(() => {
    mocks.generateTeamsAPIMock.mockReset()
  })

  it('calls generateTeamsAPI and onDone on success', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    mocks.generateTeamsAPIMock.mockResolvedValueOnce({
      success: true,
      teamsGenerated: 2,
    })

    render(
      <RestoreRsvpOrderButton
        matchId="match1"
        onDone={onDone}
        showError="inline"
      />
    )

    await user.click(
      screen.getByRole('button', { name: /restore rsvp order/i })
    )

    expect(mocks.generateTeamsAPIMock).toHaveBeenCalledWith('match1')
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByText(/failed to restore rsvp order/i)
    ).not.toBeInTheDocument()
  })

  it('shows error message when restore fails', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    mocks.generateTeamsAPIMock.mockRejectedValueOnce(new Error('boom'))

    render(
      <RestoreRsvpOrderButton
        matchId="match1"
        onDone={onDone}
        showError="inline"
      />
    )

    await user.click(
      screen.getByRole('button', { name: /restore rsvp order/i })
    )

    expect(onDone).not.toHaveBeenCalled()
    expect(
      screen.getByText(/failed to restore rsvp order/i)
    ).toBeInTheDocument()
  })

  it('renders a disabled control when disabled', () => {
    render(
      <RestoreRsvpOrderButton
        matchId="match1"
        onDone={vi.fn()}
        disabled
        showError="inline"
      />
    )

    expect(
      screen.getByRole('button', { name: /restore rsvp order/i })
    ).toBeDisabled()
  })
})
