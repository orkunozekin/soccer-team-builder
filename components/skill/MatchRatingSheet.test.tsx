import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type MatchRatingPlayer, MatchRatingSheet } from './MatchRatingSheet'
import { saveClubSkillRankingAPI } from '@/lib/api/client'
import type { ClubSkillRankingDTO, SkillRatings } from '@/types/skill'

vi.mock('@/lib/api/client', () => ({
  saveClubSkillRankingAPI: vi.fn(),
}))

const players: MatchRatingPlayer[] = [
  {
    userId: 'u1',
    displayName: 'Alice',
    position: 'ST',
    teamName: 'Team 1',
    teamColor: 'red',
  },
  {
    userId: 'u2',
    displayName: 'Bob',
    position: 'GK',
    teamName: 'Team 2',
    teamColor: 'blue',
  },
  {
    userId: 'u3',
    displayName: 'Cara',
    position: null,
    teamName: 'Team 1',
    teamColor: 'red',
  },
  {
    userId: 'u4',
    displayName: 'Dan',
    position: 'CM',
    teamName: 'Team 2',
    teamColor: 'blue',
  },
]

function Harness({
  ratings = { u1: 8, u3: 4 },
  memberIds = new Set(['u1', 'u2', 'u3', 'u4']),
  onSaved = vi.fn(),
}: {
  ratings?: SkillRatings
  memberIds?: ReadonlySet<string>
  onSaved?: (ranking: ClubSkillRankingDTO) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open sheet
      </button>
      <MatchRatingSheet
        open={open}
        onOpenChange={setOpen}
        clubId="club1"
        players={players}
        ratings={ratings}
        memberIds={memberIds}
        onSaved={onSaved}
      />
    </>
  )
}

function rowNames() {
  const list = within(screen.getByRole('dialog')).getByRole('list')
  return within(list)
    .getAllByRole('listitem')
    .map(li => li.querySelector('.font-semibold')?.textContent)
}

async function openSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Open sheet' }))
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
}

async function rate(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  value: string
) {
  if (!screen.queryByRole('radiogroup', { name: `Rating for ${name}` })) {
    await user.click(
      screen.getByRole('button', { name: new RegExp(`^${name}`) })
    )
  }
  await user.click(
    within(
      screen.getByRole('radiogroup', { name: `Rating for ${name}` })
    ).getByRole('radio', { name: value })
  )
}

describe('MatchRatingSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists unrated players first, with team and rating', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openSheet(user)

    expect(rowNames()).toEqual(['Bob', 'Dan', 'Alice', 'Cara'])
    expect(screen.getByText('Team 2 · GK')).toBeInTheDocument()
    expect(screen.getByLabelText('Alice: rated 8')).toBeInTheDocument()
    expect(screen.getByLabelText('Bob: not rated')).toBeInTheDocument()
    expect(screen.getByText('2 of 4 rated')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save ratings' })).toBeDisabled()
  })

  it('filters to unrated players', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openSheet(user)

    await user.click(screen.getByRole('radio', { name: 'Unrated 2' }))
    expect(rowNames()).toEqual(['Bob', 'Dan'])
    // A player rated in this session stays in the list until the next open.
    await rate(user, 'Bob', '6')
    expect(rowNames()).toEqual(['Bob', 'Dan'])
  })

  it('saves only the changes, then closes and reports the merged ratings', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    const merged = { ratings: { u1: 8, u2: 6, u4: 2 }, version: 4 }
    vi.mocked(saveClubSkillRankingAPI).mockResolvedValue({
      success: true,
      ranking: merged as ClubSkillRankingDTO,
    })
    render(<Harness onSaved={onSaved} />)
    await openSheet(user)

    await rate(user, 'Bob', '6')
    await rate(user, 'Dan', '2')
    await user.click(screen.getByRole('button', { name: /^Cara/ }))
    await user.click(screen.getByRole('button', { name: 'Clear rating' }))
    expect(screen.getByText('3 changes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save ratings' }))

    expect(saveClubSkillRankingAPI).toHaveBeenCalledWith('club1', {
      u2: 6,
      u4: 2,
      u3: null,
    })
    expect(onSaved).toHaveBeenCalledWith(merged)
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(document.body.style.pointerEvents).not.toBe('none')
  })

  it('keeps the sheet and edits open on a save error', async () => {
    const user = userEvent.setup()
    vi.mocked(saveClubSkillRankingAPI).mockRejectedValue(
      new Error('Only active club members can be rated')
    )
    render(<Harness />)
    await openSheet(user)

    await rate(user, 'Bob', '7')
    await user.click(screen.getByRole('button', { name: 'Save ratings' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only active club members can be rated'
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Bob: rated 7')).toBeInTheDocument()
  })

  it('discards edits on Cancel and starts fresh on reopen', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openSheet(user)

    await rate(user, 'Bob', '7')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(document.body.style.pointerEvents).not.toBe('none')

    await openSheet(user)
    expect(screen.getByLabelText('Bob: not rated')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save ratings' })).toBeDisabled()
    expect(saveClubSkillRankingAPI).not.toHaveBeenCalled()
  })

  it("doesn't let non-members be rated", async () => {
    const user = userEvent.setup()
    render(<Harness memberIds={new Set(['u1', 'u2', 'u3'])} />)
    await openSheet(user)

    const dan = screen.getByRole('button', { name: /^Dan/ })
    expect(dan).toBeDisabled()
    expect(within(dan).getByText(/Not a club member/)).toBeInTheDocument()
    expect(screen.getByText('2 of 3 rated')).toBeInTheDocument()
  })
})
