import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { MyMatchRsvpsState } from '@/lib/hooks/useMyMatchRsvps'
import type { Match } from '@/types/match'
import type { RSVP } from '@/types/rsvp'
import { MatchesList } from './MatchesList'

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
    <MatchesList
      matches={matches}
      rsvpCounts={{ next: 18, b: 12 }}
      hrefFor={id => `/c/club/matches/${id}`}
      myRsvps={myRsvps}
      onRetryMyRsvps={onRetryMyRsvps}
      paginationScope="club"
    />
  )
}

describe('MatchesList', () => {
  it('features the soonest match as the Next up hero', () => {
    renderList([makeMatch('b', 3), makeMatch('next', 1, true)])
    const hero = screen.getByRole('link', { name: /^Next up:/ })
    expect(hero).toHaveAttribute('href', '/c/club/matches/next')
    expect(hero).toHaveAccessibleName(/RSVP open/)
    expect(within(hero).getByText('18/22')).toBeInTheDocument()
    expect(screen.getByText(/4 spots to fill 2 teams/)).toBeInTheDocument()
  })

  it('links every match, including ones whose RSVP is not open', () => {
    renderList([makeMatch('next', 1, false), makeMatch('b', 3, false)])
    expect(screen.getByRole('link', { name: /^Next up:/ })).toHaveAttribute(
      'href',
      '/c/club/matches/next'
    )
    const [row] = rowsOf()
    expect(within(row).getByRole('link')).toHaveAttribute(
      'href',
      '/c/club/matches/b'
    )
    expect(within(row).getByText(/Field b/)).toBeInTheDocument()
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

  it('gives admins a Past filter with newest matches first and row actions', async () => {
    const user = userEvent.setup()
    // Fixtures are in 2030; these two finished long before.
    const pastMatch = (id: string, day: number): Match => ({
      ...makeMatch(id, 0),
      date: new Date(2020, 0, day, 19, 30),
    })
    render(
      <MatchesList
        matches={[
          makeMatch('next', 1, true),
          pastMatch('older', 1),
          pastMatch('old', 5),
        ]}
        rsvpCounts={{}}
        hrefFor={id => `/c/club/matches/${id}`}
        myRsvps={ready()}
        onRetryMyRsvps={vi.fn()}
        paginationScope="club"
        includePast
        matchActions={m => <button type="button">Delete {m.id}</button>}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Past' }))
    const rows = rowsOf()
    expect(
      rows.map(r => within(r).getByRole('link').getAttribute('href'))
    ).toEqual(['/c/club/matches/old', '/c/club/matches/older'])
    expect(within(rows[0]).getByText('Match ended')).toBeInTheDocument()
    // The action sits beside the row link, not inside it.
    const action = within(rows[0]).getByRole('button', { name: 'Delete old' })
    expect(within(rows[0]).getByRole('link')).not.toContainElement(action)
  })

  it('offers match actions for the Next up match too, outside its link', () => {
    render(
      <MatchesList
        matches={[makeMatch('next', 1, true)]}
        rsvpCounts={{}}
        hrefFor={id => `/c/club/matches/${id}`}
        myRsvps={ready()}
        onRetryMyRsvps={vi.fn()}
        paginationScope="club"
        includePast
        matchActions={m => <button type="button">Delete {m.id}</button>}
      />
    )
    const action = screen.getByRole('button', { name: 'Delete next' })
    expect(
      screen.getByRole('link', { name: /^Next up:/ })
    ).not.toContainElement(action)
  })

  it('hides the Past filter from players', () => {
    renderList([makeMatch('next', 1, true), makeMatch('b', 3)])
    expect(
      screen.queryByRole('button', { name: 'Past' })
    ).not.toBeInTheDocument()
  })

  it('explains when nothing is upcoming', () => {
    renderList([])
    expect(screen.getByText('No upcoming matches yet.')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /^Next up:/ })
    ).not.toBeInTheDocument()
  })
})
