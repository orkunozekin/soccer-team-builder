import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayerMarker } from './PlayerMarker'
import type { Team } from '@/types/team'
import type { User } from '@/types/user'

function makeUser(overrides: Partial<User> = {}): User {
  return {
    uid: 'u1',
    email: 'u1@example.com',
    displayName: 'Alex Keeper',
    jerseyNumber: 1,
    position: 'GK',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

const team: Team = {
  id: 't1',
  matchId: 'm1',
  teamNumber: 1,
  name: 'Team 1',
  color: '#1e40af',
  playerIds: ['u1'],
  maxSize: 11,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('PlayerMarker', () => {
  it('renders goalkeeper names in black', () => {
    render(
      <PlayerMarker
        user={makeUser()}
        position={{ x: 50, y: 5 }}
        team={team}
        isMobile={false}
        isAdmin={false}
      />
    )

    const name = screen.getByText('Alex K.')
    expect(name.className).toContain('text-black')
    expect(name.className).toContain('bg-white/90')
    expect(name.className).toContain('leading-tight')
    expect(name.className).not.toMatch(/(?:^|\s)text-white(?:\s|$)/)
  })

  it('renders outfield names in white', () => {
    render(
      <PlayerMarker
        user={makeUser({ position: 'ST', displayName: 'Sam Striker' })}
        position={{ x: 50, y: 80 }}
        team={team}
        isMobile={false}
        isAdmin={false}
      />
    )

    const name = screen.getByText('Sam S.')
    expect(name.className).toContain('text-white')
  })

  it('places the name above the marker near the bottom pitch edge', () => {
    const { container } = render(
      <PlayerMarker
        user={makeUser({ displayName: 'Jordan Goalie' })}
        position={{ x: 50, y: 84 }}
        team={team}
        isMobile={false}
        isAdmin={false}
      />
    )

    const labelWrap = screen.getByText('Jordan G.').parentElement
    expect(labelWrap?.className).toContain('bottom-full')
    expect(labelWrap?.className).not.toContain('top-full')
    expect(container.firstChild).toBeTruthy()
  })

  it('places the name below the marker away from the bottom edge', () => {
    render(
      <PlayerMarker
        user={makeUser()}
        position={{ x: 50, y: 5 }}
        team={team}
        isMobile={false}
        isAdmin={false}
      />
    )

    const labelWrap = screen.getByText('Alex K.').parentElement
    expect(labelWrap?.className).toContain('top-full')
    expect(labelWrap?.className).not.toContain('bottom-full')
  })
})
