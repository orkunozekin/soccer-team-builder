import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RsvpOrderCard } from './RsvpOrderCard'
import type { RSVP } from '@/types/rsvp'
import type { User } from '@/types/user'

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
  it('shows confirmed RSVPs sorted by rsvpAt ascending', () => {
    const matchRSVPs = [
      makeRsvp('r2', 'u2', new Date('2026-01-02T12:00:00Z')),
      makeRsvp('r1', 'u1', new Date('2026-01-01T12:00:00Z')),
    ]

    render(<RsvpOrderCard matchRSVPs={matchRSVPs} users={users} />)

    const names = screen.getAllByText(/Alice|Bob/).map(el => el.textContent)
    expect(names[0]).toContain('Alice')
    expect(names[1]).toContain('Bob')
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('prefers RSVP position over profile position', () => {
    const matchRSVPs = [
      makeRsvp('r1', 'u1', new Date('2026-01-01T12:00:00Z'), 'GK'),
    ]

    render(<RsvpOrderCard matchRSVPs={matchRSVPs} users={users} />)

    expect(screen.getByText('GK (Goalkeeper)')).toBeInTheDocument()
  })

  it('shows empty state when there are no confirmed RSVPs', () => {
    render(<RsvpOrderCard matchRSVPs={[]} users={users} />)

    expect(screen.getByText(/no confirmed rsvps yet/i)).toBeInTheDocument()
  })

  it('ignores cancelled RSVPs', () => {
    const matchRSVPs: RSVP[] = [
      {
        ...makeRsvp('r1', 'u1', new Date('2026-01-01T12:00:00Z')),
        status: 'cancelled',
      },
    ]

    render(<RsvpOrderCard matchRSVPs={matchRSVPs} users={users} />)

    expect(screen.getByText(/no confirmed rsvps yet/i)).toBeInTheDocument()
  })
})
