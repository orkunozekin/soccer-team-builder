import { render, screen, waitFor } from '@testing-library/react'
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

  it('calls generateTeamsAPI with restoreRsvpOrder and awaits onDone', async () => {
    const user = userEvent.setup()
    let resolveDone: (() => void) | undefined
    const onDone = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveDone = resolve
        })
    )
    mocks.generateTeamsAPIMock.mockResolvedValueOnce({
      success: true,
      teamsGenerated: 2,
      restoreRsvpOrder: true,
    })

    render(
      <RestoreRsvpOrderButton
        matchId="match1"
        onDone={onDone}
        showError="inline"
      />
    )

    const button = screen.getByRole('button', { name: /restore rsvp order/i })
    await user.click(button)

    expect(mocks.generateTeamsAPIMock).toHaveBeenCalledWith('match1', {
      restoreRsvpOrder: true,
    })
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()

    resolveDone?.()
    await waitFor(() => {
      expect(button).not.toBeDisabled()
    })
    expect(
      screen.queryByText(/failed to restore rsvp order/i)
    ).not.toBeInTheDocument()
  })

  it('shows restore error when the API fails', async () => {
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

  it('keeps restore success and reports refresh failure separately', async () => {
    const user = userEvent.setup()
    mocks.generateTeamsAPIMock.mockResolvedValueOnce({
      success: true,
      teamsGenerated: 2,
      restoreRsvpOrder: true,
    })
    const onDone = vi.fn().mockRejectedValueOnce(new Error('refresh failed'))

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

    expect(onDone).toHaveBeenCalledTimes(1)
    expect(
      screen.getByText(/teams restored, but failed to refresh/i)
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/failed to restore rsvp order/i)
    ).not.toBeInTheDocument()
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
