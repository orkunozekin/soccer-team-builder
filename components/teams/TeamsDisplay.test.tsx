import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeatureFlagContext } from '@/components/flags/FeatureFlagContext'
import { TeamsDisplay } from './TeamsDisplay'
import type { Team } from '@/types/team'
import type { User } from '@/types/user'

vi.mock('@/lib/api/client', () => ({
  cancelRSVPAPI: vi.fn(),
  hostCheckInAllAPI: vi.fn(),
  hostCheckInAPI: vi.fn(),
  transferPlayerAPI: vi.fn(),
}))

vi.mock('@/store/matchStore', () => ({
  useMatchStore: () => ({
    updateRSVPAttendance: vi.fn(),
    bulkUpdateRSVPAttendance: vi.fn(),
  }),
}))

vi.mock('@/lib/hooks/useWindowWidth', () => ({
  useWindowWidth: () => 1024,
}))

function makeUser(id: string, position: string): User {
  return {
    uid: id,
    email: `${id}@example.com`,
    displayName: id,
    jerseyNumber: 7,
    position,
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeTeam(
  id: string,
  teamNumber: number,
  playerIds: string[],
  color: string
): Team {
  return {
    id,
    matchId: 'm1',
    teamNumber,
    name: `Team ${teamNumber}`,
    color,
    playerIds,
    maxSize: 11,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

const users = [
  makeUser('u1', 'ST'),
  makeUser('u2', 'GK'),
  makeUser('u3', 'CB'),
  makeUser('u4', 'CM'),
]
const teams = [
  makeTeam('t1', 1, ['u1', 'u2'], '#1e40af'),
  makeTeam('t2', 2, ['u3', 'u4'], '#991b1b'),
]

describe('TeamsDisplay pitch flag', () => {
  it('keeps list view only when pitch-lineup-view is off', () => {
    render(
      <FeatureFlagContext.Provider value={{ 'pitch-lineup-view': false }}>
        <TeamsDisplay teams={teams} users={users} />
      </FeatureFlagContext.Provider>
    )

    expect(screen.getByText('Teams')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Teams view' })).toBeNull()
    expect(screen.getByText('Team 1')).toBeInTheDocument()
    expect(screen.queryByText('Pitch')).toBeNull()
  })

  it('shows List/Pitch toggle when flag is on and defaults to list', async () => {
    const user = userEvent.setup()
    render(
      <FeatureFlagContext.Provider value={{ 'pitch-lineup-view': true }}>
        <TeamsDisplay teams={teams} users={users} isAdmin={true} />
      </FeatureFlagContext.Provider>
    )

    expect(screen.getByRole('group', { name: 'Teams view' })).toBeInTheDocument()
    // Defaults to list — team cards, not pitch markers
    expect(screen.getByText('Team 1')).toBeInTheDocument()

    const buttons = screen.getAllByRole('button', { name: /list|pitch/i })
    expect(buttons.map(b => b.textContent)).toEqual(['List', 'Pitch'])

    await user.click(screen.getByRole('button', { name: 'Pitch' }))
    expect(screen.queryByText('Team 1')).toBeNull()
    expect(screen.getByText('u1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'List' }))
    expect(screen.getByText('Team 1')).toBeInTheDocument()
  })
})
