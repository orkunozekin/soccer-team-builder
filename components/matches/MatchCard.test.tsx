import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MatchCard } from './MatchCard'
import { Match } from '@/types/match'

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    date: new Date(2030, 0, 10, 19, 30),
    time: '19:30',
    location: {
      name: 'Riverside Park Field 3',
      address: '1200 River Rd',
      lat: null,
      lng: null,
    },
    clubId: 'c1',
    rsvpOpen: true,
    rsvpOpenAt: null,
    rsvpCloseAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('MatchCard', () => {
  it('links open matches to their detail page with a live status', () => {
    render(<MatchCard match={makeMatch()} rsvpCount={18} href="/c/a/m1" />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/c/a/m1')
    expect(screen.getByText(/^RSVP open/)).toBeInTheDocument()
    expect(screen.getByTestId('status-pill-dot')).toBeInTheDocument()
    expect(screen.getByText('18 players confirmed')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Thursday, Jan 10 · 7:30 PM/ })
    ).toBeInTheDocument()
  })

  it('links closed matches too, with a closed status', () => {
    render(<MatchCard match={makeMatch({ rsvpOpen: false })} href="/c/a/m1" />)
    expect(screen.getByRole('link', { name: /7:30 PM/ })).toHaveAttribute(
      'href',
      '/c/a/m1'
    )
    expect(screen.queryByTestId('status-pill-dot')).not.toBeInTheDocument()
    expect(screen.queryByText(/Click to view details/)).not.toBeInTheDocument()
  })
})
