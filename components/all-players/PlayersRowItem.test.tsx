import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PlayersRowItem from './PlayersRowItem'
import type { Player } from '@/interfaces/Player.interface'

vi.mock('../player/PlayerName', () => ({
  __esModule: true,
  default: (props: { player: Player }) => (
    <div>PlayerName: {props.player.name}</div>
  ),
}))

vi.mock('../KebabMenu', () => ({
  __esModule: true,
  default: (props: { kebabMenuItems: unknown[] }) => (
    <div>KebabMenu: {props.kebabMenuItems.length} items</div>
  ),
}))

describe('PlayersRowItem', () => {
  it('renders player name and kebab menu', () => {
    const player = {
      id: 'p1',
      name: 'Player One',
    } as Player

    render(
      <PlayersRowItem
        player={player}
        kebabMenuItems={[{}, {}] as any}
        className="extra-class"
      />
    )

    expect(screen.getByText(/playername: player one/i)).toBeInTheDocument()
    expect(screen.getByText(/kebabmenu: 2 items/i)).toBeInTheDocument()
  })
})
