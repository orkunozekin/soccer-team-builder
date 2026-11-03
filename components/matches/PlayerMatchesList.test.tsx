import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { MyMatchRsvpsState } from '@/lib/hooks/useMyMatchRsvps'
import type { Match } from '@/types/match'
import type { RSVP } from '@/types/rsvp'
import { PlayerMatchesList } from './PlayerMatchesList'

function makeMatch(id: string, daysAhead: number, rsvpOpen = false): Match {
  const date = new Date(2030, 0, 10 + daysAhead, 19, 30)
  return {
    id,
    date,
    time: '19:30',
    location: { name: `Field ${id}`, address: 'Addr', lat: null, lng: null },
    clubId: 'c1',
    rsvpOpen,
    rsvpOpenAt: null,
    rsvpCloseAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

const confirmed = (matchId: string): RSVP => ({
  id: `r_${matchId}`,
  matchId,
  userId: 'u1',
  status: 'confirmed',
  position: 'ST',
  jerseyNumber: 10,
  attended: null,
  checkedInAt: null,
  checkInMethod: null,
  rsvpAt: new Date(),
  updatedAt: new Date(),
})

const ready = (rsvps: RSVP[] = []): MyMatchRsvpsState => ({
  status: 'ready',
  byMatchId: new Map(rsvps.map(r => [r.matchId, r])),
})

const rowsOf = () =>
  within(screen.getByRole('list', { name: 'Matches' })).getAllByRole('listitem')

function renderList(
  matches: Match[],
  myRsvps: MyMatchRsvpsState = ready(),
  onRetryMyRsvps = vi.fn()
) {
  return render(
    <PlayerMatchesList
      matches={matches}
      rsvpCounts={{ next: 18, b: 12 }}
      hrefFor={id => `/c/club/matches/${id}`}
      canOpen={m => m.rsvpOpen}
      myRsvps={myRsvps}
      onRetryMyRsvps={onRetryMyRsvps}
      paginationScope="club"
    />
  )
}

describe('PlayerMatchesList', () => {
  it('features the soonest match as the Next up hero', () => {
    renderList([makeMatch('b', 3), makeMatch('next', 1, true)])
    const hero = screen.getByRole('link', { name: /^Next up:/ })
    expect(hero).toHaveAttribute('href', '/c/club/matches/next')
    expect(hero).toHaveAccessibleName(/RSVP open/)
    expect(within(hero).getByText('18/22')).toBeInTheDocument()
    expect(screen.getByText(/4 spots to fill 2 teams/)).toBeInTheDocument()
  })

  it('lists the remaining matches as rows and only links open ones', () => {
    renderList([makeMatch('next', 1, true), makeMatch('b', 3)])
    const rows = rowsOf()
    expect(rows).toHaveLength(1)
    expect(within(rows[0]).queryByRole('link')).not.toBeInTheDocument()
    expect(within(rows[0]).getByText(/Field b/)).toBeInTheDocument()
  })

  it('filters rows to matches the player is in and shows their spot', async () => {
    const user = userEvent.setup()
    renderList(
      [makeMatch('next', 1, true), makeMatch('b', 3), makeMatch('c', 5)],
      ready([confirmed('b')])
    )
    expect(screen.getByText("You're in · ST · 12/22")).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: "I'm in" }))
    expect(screen.getByRole('button', { name: "I'm in" })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    const rows = rowsOf()
    expect(rows).toHaveLength(1)
    expect(within(rows[0]).getByText(/Field b/)).toBeInTheDocument()
  })

  it('offers a retry when the RSVP lookup failed', async () => {
    const user = userEvent.setup()
    const retry = vi.fn()
    renderList(
      [makeMatch('next', 1, true), makeMatch('b', 3)],
      { status: 'error', byMatchId: new Map() },
      retry
    )
    await user.click(screen.getByRole('button', { name: "I'm in" }))
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('paginates long lists of rows', async () => {
    const user = userEvent.setup()
    const matches = Array.from({ length: 13 }, (_, i) =>
      makeMatch(`m${i}`, i + 1)
    )
    renderList(matches)
    expect(rowsOf()).toHaveLength(10)
    await user.click(screen.getByRole('button', { name: 'Go to page 2' }))
    expect(rowsOf()).toHaveLength(2)
  })

  it('renders nothing without matches', () => {
    const { container } = renderList([])
    expect(container).toBeEmptyDOMElement()
  })
})
