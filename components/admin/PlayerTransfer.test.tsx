import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlayerTransfer } from './PlayerTransfer'
import type { Team } from '@/types/team'
import type { User } from '@/types/user'

vi.mock('@/lib/api/client', () => ({
  transferPlayerAPI: vi.fn(),
}))

const teams: Team[] = [
  {
    id: 't1',
    matchId: 'match1',
    name: 'Team 1',
    teamNumber: 1,
    color: '#3b82f6',
    playerIds: ['u1'],
    maxSize: 8,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

const users: User[] = [
  {
    uid: 'u1',
    email: 'alice@example.com',
    displayName: 'Alice',
    role: 'user',
    position: 'CM',
    jerseyNumber: 8,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

describe('PlayerTransfer', () => {
  it('is collapsed by default', () => {
    render(
      <PlayerTransfer matchId="match1" teams={teams} users={users} />
    )

    expect(screen.queryByText(/move a player/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /transfer player/i })
    ).toHaveAttribute('data-state', 'closed')
  })

  it('expands to show transfer controls', async () => {
    const user = userEvent.setup()
    render(
      <PlayerTransfer matchId="match1" teams={teams} users={users} />
    )

    await user.click(screen.getByRole('button', { name: /transfer player/i }))

    expect(screen.getByText(/move a player to another team/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^move$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^swap$/i })).toBeInTheDocument()
  })
})
