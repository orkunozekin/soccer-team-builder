import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RsvpOrderCard } from './RsvpOrderCard'
import type { RSVP } from '@/types/rsvp'
import type { User } from '@/types/user'

const mocks = vi.hoisted(() => ({
  generateTeamsAPIMock: vi.fn(),
}))

vi.mock('@/lib/api/client', () => ({
  generateTeamsAPI: (...args: unknown[]) => mocks.generateTeamsAPIMock(...args),
}))

function makeRsvp(
  id: string,
  userId: string,
  rsvpAt: Date,
  position: string | null = null
): RSVP {
  return {
    id,
    matchId: 'match1',
    userId,
    status: 'confirmed',
    position,
    jerseyNumber: null,
    attended: null,
    checkedInAt: null,
    checkInMethod: null,
    rsvpAt,
    updatedAt: rsvpAt,
  }
}

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
  {
    uid: 'u2',
    email: 'bob@example.com',
    displayName: 'Bob',
    role: 'user',
    position: 'ST',
    jerseyNumber: 9,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

describe('RsvpOrderCard', () => {
  beforeEach(() => {
    mocks.generateTeamsAPIMock.mockReset()
  })

  it('paginates confirmed players with absolute ranks and clamps after cancellations', async () => {
    const user = userEvent.setup()
    const rsvps = Array.from({ length: 21 }, (_, i) =>
      makeRsvp(`r${i}`, `player-${i + 1}`, new Date(2026, 0, 1, 0, i))
    ).reverse()
    const { rerender } = render(<RsvpOrderCard matchRSVPs={rsvps} users={[]} />)
    await user.click(screen.getByRole('button', { name: 'RSVP order (21)' }))
    expect(screen.getByText('player-1')).toBeInTheDocument()
    expect(screen.queryByText('player-11')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go to page 3' }))
    expect(screen.getByText('player-21')).toBeInTheDocument()
    expect(screen.getByText('21')).toBeInTheDocument()
    expect(screen.getByText('Showing 21–21 of 21 RSVPs')).toBeInTheDocument()
    rerender(<RsvpOrderCard matchRSVPs={rsvps.slice(11)} users={[]} />)
    expect(screen.getByText('player-1')).toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Pagination' })
    ).not.toBeInTheDocument()
  })

  it('shows confirmed RSVPs sorted by rsvpAt ascending', async () => {
    const user = userEvent.setup()
    const matchRSVPs = [
      makeRsvp('r2', 'u2', new Date('2026-01-02T12:00:00Z')),
      makeRsvp('r1', 'u1', new Date('2026-01-01T12:00:00Z')),
    ]

    render(<RsvpOrderCard matchRSVPs={matchRSVPs} users={users} />)

    await user.click(screen.getByRole('button', { name: /rsvp order \(2\)/i }))

    const names = screen.getAllByText(/Alice|Bob/).map(el => el.textContent)
    expect(names[0]).toContain('Alice')
    expect(names[1]).toContain('Bob')
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('does not show player positions', async () => {
    const user = userEvent.setup()
    const matchRSVPs = [
      makeRsvp('r1', 'u1', new Date('2026-01-01T12:00:00Z'), 'GK'),
      makeRsvp('r2', 'u2', new Date('2026-01-02T12:00:00Z'), 'ST'),
    ]

    render(<RsvpOrderCard matchRSVPs={matchRSVPs} users={users} />)

    await user.click(screen.getByRole('button', { name: /rsvp order \(2\)/i }))

    expect(screen.queryByText(/goalkeeper/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/striker/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/\bCM\b/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\bST\b/)).not.toBeInTheDocument()
  })

  it('shows empty state when there are no confirmed RSVPs', async () => {
    const user = userEvent.setup()

    render(<RsvpOrderCard matchRSVPs={[]} users={users} />)

    await user.click(screen.getByRole('button', { name: /rsvp order \(0\)/i }))

    expect(screen.getByText(/no confirmed rsvps yet/i)).toBeInTheDocument()
  })

  it('is collapsed by default', () => {
    const matchRSVPs = [makeRsvp('r1', 'u1', new Date('2026-01-01T12:00:00Z'))]

    render(<RsvpOrderCard matchRSVPs={matchRSVPs} users={users} />)

    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /rsvp order \(1\)/i })
    ).toHaveAttribute('data-state', 'closed')
  })

  it('ignores cancelled RSVPs', async () => {
    const matchRSVPs: RSVP[] = [
      {
        ...makeRsvp('r1', 'u1', new Date('2026-01-01T12:00:00Z')),
        status: 'cancelled',
      },
    ]

    render(<RsvpOrderCard matchRSVPs={matchRSVPs} users={users} />)

    await userEvent.click(
      screen.getByRole('button', { name: /rsvp order \(0\)/i })
    )

    expect(screen.getByText(/no confirmed rsvps yet/i)).toBeInTheDocument()
  })

  it('describes RSVP-order team fill while collapsed', () => {
    render(
      <RsvpOrderCard
        matchRSVPs={[makeRsvp('r1', 'u1', new Date('2026-01-01T12:00:00Z'))]}
        users={users}
      />
    )

    const trigger = screen.getByRole('button', { name: /rsvp order \(1\)/i })
    expect(trigger).toHaveAttribute('data-state', 'closed')
    expect(trigger).toHaveAccessibleName('RSVP order (1)')
    expect(trigger).toHaveAccessibleDescription(
      /teams are filled in this order/i
    )
    expect(
      screen.getByText(/teams are filled in this order/i)
    ).toBeInTheDocument()
  })

  it('hides restore control when matchId/onRestoreComplete are omitted', async () => {
    const user = userEvent.setup()
    const matchRSVPs = [
      makeRsvp('r1', 'u1', new Date('2026-01-01T12:00:00Z')),
      makeRsvp('r2', 'u2', new Date('2026-01-02T12:00:00Z')),
    ]

    render(<RsvpOrderCard matchRSVPs={matchRSVPs} users={users} />)
    await user.click(screen.getByRole('button', { name: /rsvp order \(2\)/i }))

    expect(
      screen.queryByRole('button', { name: /restore rsvp order/i })
    ).not.toBeInTheDocument()
  })

  it('shows restore control for admins and calls onRestoreComplete', async () => {
    const user = userEvent.setup()
    const onRestoreComplete = vi.fn()
    mocks.generateTeamsAPIMock.mockResolvedValueOnce({
      success: true,
      teamsGenerated: 2,
    })
    const matchRSVPs = [
      makeRsvp('r1', 'u1', new Date('2026-01-01T12:00:00Z')),
      makeRsvp('r2', 'u2', new Date('2026-01-02T12:00:00Z')),
    ]

    render(
      <RsvpOrderCard
        matchId="match1"
        matchRSVPs={matchRSVPs}
        users={users}
        onRestoreComplete={onRestoreComplete}
      />
    )
    await user.click(screen.getByRole('button', { name: /rsvp order \(2\)/i }))

    expect(
      screen.getByText(/saved admin transfers are re-applied/i)
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /restore rsvp order/i })
    )

    expect(mocks.generateTeamsAPIMock).toHaveBeenCalledWith('match1', {
      restoreRsvpOrder: true,
    })
    expect(onRestoreComplete).toHaveBeenCalledTimes(1)
  })

  it('disables restore when fewer than two confirmed RSVPs', async () => {
    const user = userEvent.setup()

    render(
      <RsvpOrderCard
        matchId="match1"
        matchRSVPs={[makeRsvp('r1', 'u1', new Date('2026-01-01T12:00:00Z'))]}
        users={users}
        onRestoreComplete={vi.fn()}
      />
    )
    await user.click(screen.getByRole('button', { name: /rsvp order \(1\)/i }))

    expect(
      screen.getByRole('button', { name: /restore rsvp order/i })
    ).toBeDisabled()
  })
})
