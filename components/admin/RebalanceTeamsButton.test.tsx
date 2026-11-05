import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RebalanceTeamsButton } from './RebalanceTeamsButton'

const mocks = vi.hoisted(() => ({
  rebalanceTeamsAPIMock: vi.fn(),
}))

vi.mock('@/lib/api/client', () => ({
  rebalanceTeamsAPI: (...args: unknown[]) =>
    mocks.rebalanceTeamsAPIMock(...args),
}))

describe('RebalanceTeamsButton', () => {
  it('calls rebalanceTeamsAPI and onDone on success', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    mocks.rebalanceTeamsAPIMock.mockResolvedValueOnce(undefined)

    render(
      <RebalanceTeamsButton
        matchId="match1"
        onDone={onDone}
        showError="inline"
      />
    )

    const button = screen.getByRole('button', { name: /rebalance teams/i })
    await user.click(button)

    expect(mocks.rebalanceTeamsAPIMock).toHaveBeenCalledWith('match1')
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByText(/failed to rebalance teams/i)
    ).not.toBeInTheDocument()
  })

  it('passes the strength summary to onSkillBalanced before onDone', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    const strength = {
      teams: [
        { teamNumber: 1, total: 10, average: 2.5, size: 4 },
        { teamNumber: 2, total: 10, average: 2.5, size: 4 },
      ],
      unratedCount: 1,
      playerCount: 8,
    }
    const onSkillBalanced = vi.fn(() => calls.push('skill'))
    const onDone = vi.fn(() => calls.push('done'))
    mocks.rebalanceTeamsAPIMock.mockResolvedValueOnce({
      success: true,
      strength,
    })

    render(
      <RebalanceTeamsButton
        matchId="match1"
        onDone={onDone}
        onSkillBalanced={onSkillBalanced}
      />
    )
    await user.click(screen.getByRole('button', { name: /rebalance teams/i }))

    expect(onSkillBalanced).toHaveBeenCalledWith(strength)
    expect(calls).toEqual(['skill', 'done'])
  })

  it('calls onSkillBalanced with null when the response has no strength', async () => {
    const user = userEvent.setup()
    const onSkillBalanced = vi.fn()
    const onDone = vi.fn()
    mocks.rebalanceTeamsAPIMock.mockResolvedValueOnce({ success: true })

    render(
      <RebalanceTeamsButton
        matchId="match1"
        onDone={onDone}
        onSkillBalanced={onSkillBalanced}
      />
    )
    await user.click(screen.getByRole('button', { name: /rebalance teams/i }))

    expect(onSkillBalanced).toHaveBeenCalledWith(null)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('does not call onSkillBalanced when rebalance fails', async () => {
    const user = userEvent.setup()
    const onSkillBalanced = vi.fn()
    mocks.rebalanceTeamsAPIMock.mockRejectedValueOnce(new Error('boom'))

    render(
      <RebalanceTeamsButton
        matchId="match1"
        onDone={vi.fn()}
        onSkillBalanced={onSkillBalanced}
      />
    )
    await user.click(screen.getByRole('button', { name: /rebalance teams/i }))

    expect(onSkillBalanced).not.toHaveBeenCalled()
  })

  it('shows error message when rebalance fails', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    mocks.rebalanceTeamsAPIMock.mockRejectedValueOnce(new Error('boom'))

    render(
      <RebalanceTeamsButton
        matchId="match1"
        onDone={onDone}
        showError="inline"
      />
    )

    const button = screen.getByRole('button', { name: /rebalance teams/i })
    await user.click(button)

    expect(onDone).not.toHaveBeenCalled()
    expect(screen.getByText(/failed to rebalance teams/i)).toBeInTheDocument()
  })
})
