import { fireEvent, render, screen } from '@testing-library/react'
import { format } from 'date-fns'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerRsvpHistory } from './PlayerRsvpHistory'
import { getMatchesByIds } from '@/lib/services/matchService'
import { getUserRSVPs } from '@/lib/services/rsvpService'
import type { Match } from '@/types/match'
import type { RSVP } from '@/types/rsvp'

vi.mock('@/lib/services/matchService', () => ({
  getMatchesByIds: vi.fn(),
}))

vi.mock('@/lib/services/rsvpService', () => ({
  getUserRSVPs: vi.fn(),
}))

function matchOn(id: string, date: Date): Match {
  return {
    id,
    date,
    time: '19:00',
    location: {
      name: 'Memorial Park',
      address: '1 Park St',
      lat: null,
      lng: null,
    },
    clubId: 'c1',
    rsvpOpen: false,
    rsvpOpenAt: null,
    rsvpCloseAt: null,
    createdAt: date,
    updatedAt: date,
  }
}

function rsvpFor(matchId: string, userId: string): RSVP {
  return {
    id: `rsvp-${matchId}`,
    matchId,
    userId,
    status: 'confirmed',
    position: null,
    jerseyNumber: null,
    attended: null,
    checkedInAt: null,
    checkInMethod: null,
    rsvpAt: new Date('2026-01-01T12:00:00Z'),
    updatedAt: new Date('2026-01-01T12:00:00Z'),
  }
}

function dateLabel(date: Date) {
  return `${format(date, 'EEE, MMM d')} · 19:00`
}

describe('PlayerRsvpHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows 10 RSVPs per page and pages through the rest', async () => {
    const dates = Array.from(
      { length: 12 },
      (_, i) => new Date(Date.UTC(2026, 5, i + 1, 12))
    )
    vi.mocked(getMatchesByIds).mockResolvedValue(
      dates.map((date, i) => matchOn(`m${i}`, date))
    )
    vi.mocked(getUserRSVPs).mockResolvedValue(
      dates.map((_, i) => rsvpFor(`m${i}`, 'u1'))
    )

    render(<PlayerRsvpHistory userId="u1" />)

    const newest = dateLabel(dates[11])
    const oldest = dateLabel(dates[0])
    expect(await screen.findByText(newest)).toBeInTheDocument()
    expect(screen.queryByText(oldest)).not.toBeInTheDocument()
    expect(screen.getByText('Showing 1–10 of 12 RSVPs')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Go to previous page' })
    ).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }))

    expect(screen.getByText(oldest)).toBeInTheDocument()
    expect(screen.queryByText(newest)).not.toBeInTheDocument()
    expect(screen.getByText('Showing 11–12 of 12 RSVPs')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Go to next page' })
    ).toBeDisabled()
  })

  it('hides pagination when the history fits on one page', async () => {
    const date = new Date(Date.UTC(2026, 5, 1, 12))
    vi.mocked(getMatchesByIds).mockResolvedValue([matchOn('m1', date)])
    vi.mocked(getUserRSVPs).mockResolvedValue([rsvpFor('m1', 'u1')])

    render(<PlayerRsvpHistory userId="u1" />)

    expect(await screen.findByText(dateLabel(date))).toBeInTheDocument()
    expect(
      screen.queryByRole('navigation', { name: 'Pagination' })
    ).not.toBeInTheDocument()
  })
})
