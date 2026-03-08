import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AllPlayersScrollArea from './AllPlayersScrollArea'

const storeState = vi.hoisted(() => ({
  players: [] as Array<{ id: string }>,
  teams: [] as Array<{ id: string; players: Array<{ id: string }> }>,
  clearPlayers: vi.fn(),
}))

vi.mock('@/store/useTeamsStore', () => ({
  useTeamsStore: () => storeState,
}))

describe('AllPlayersScrollArea', () => {
  it('renders nothing when there are no players', () => {
    storeState.players = []

    const { container } = render(<AllPlayersScrollArea />)

    expect(container).toBeEmptyDOMElement()
  })

  it('shows accordion with player count and calls clearPlayers when button clicked', async () => {
    const user = userEvent.setup()
    storeState.players = [{ id: 'p1' }, { id: 'p2' }]
    storeState.clearPlayers.mockReset()

    render(<AllPlayersScrollArea />)

    const headerButton = screen.getByRole('button', {
      name: /all players \(2\)/i,
    })
    await user.click(headerButton)

    const clearButton = await screen.findByRole('button', {
      name: /clear players/i,
    })
    await user.click(clearButton)

    expect(storeState.clearPlayers).toHaveBeenCalledTimes(1)
  })
})
