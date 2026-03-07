import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RebalanceTeamsButton } from './RebalanceTeamsButton'

const mocks = vi.hoisted(() => ({
  rebalanceTeamsAPIMock: vi.fn(),
}))

vi.mock('@/lib/api/client', () => ({
  rebalanceTeamsAPI: (...args: unknown[]) => mocks.rebalanceTeamsAPIMock(...args),
}))

describe('RebalanceTeamsButton', () => {
  it('calls rebalanceTeamsAPI and onDone on success', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    mocks.rebalanceTeamsAPIMock.mockResolvedValueOnce(undefined)

    render(
      <RebalanceTeamsButton matchId="match1" onDone={onDone} showError="inline" />
    )

    const button = screen.getByRole('button', { name: /rebalance teams/i })
    await user.click(button)

    expect(mocks.rebalanceTeamsAPIMock).toHaveBeenCalledWith('match1')
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByText(/failed to rebalance teams/i)
    ).not.toBeInTheDocument()
  })

  it('shows error message when rebalance fails', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    mocks.rebalanceTeamsAPIMock.mockRejectedValueOnce(new Error('boom'))

    render(
      <RebalanceTeamsButton matchId="match1" onDone={onDone} showError="inline" />
    )

    const button = screen.getByRole('button', { name: /rebalance teams/i })
    await user.click(button)

    expect(onDone).not.toHaveBeenCalled()
    expect(
      screen.getByText(/failed to rebalance teams/i)
    ).toBeInTheDocument()
  })
})

