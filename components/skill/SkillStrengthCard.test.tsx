import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SkillStrengthCard } from './SkillStrengthCard'
import type { RebalanceStrengthSummary } from '@/types/skill'

const summary: RebalanceStrengthSummary = {
  teams: [
    { teamNumber: 1, total: 20.25, average: 2.89, size: 7 },
    { teamNumber: 2, total: 20, average: 2.86, size: 7 },
  ],
  unratedCount: 3,
  playerCount: 14,
}

describe('SkillStrengthCard', () => {
  it('shows the header, admins-only label and one row per team', () => {
    render(<SkillStrengthCard summary={summary} onDismiss={() => {}} />)

    expect(
      screen.getByRole('heading', { name: 'Balanced by skill' })
    ).toBeInTheDocument()
    expect(screen.getByText('Admins only')).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Team 1')
    expect(rows[0]).toHaveTextContent('20.3')
    expect(rows[1]).toHaveTextContent('Team 2')
    expect(rows[1]).toHaveTextContent('20.0')
  })

  it('explains unrated players and links to the roster when a slug is known', () => {
    render(
      <SkillStrengthCard
        summary={summary}
        rosterHref="/c/fc-test/roster"
        onDismiss={() => {}}
      />
    )

    expect(
      screen.getByText(
        /3 of 14 players have no ranking or questionnaire, so they count as average\./
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Rank players' })).toHaveAttribute(
      'href',
      '/c/fc-test/roster'
    )
  })

  it('omits the roster link without a slug and the note when everyone is rated', () => {
    const { rerender } = render(
      <SkillStrengthCard summary={summary} onDismiss={() => {}} />
    )
    expect(screen.getByText(/3 of 14 players/)).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Rank players' })
    ).not.toBeInTheDocument()

    rerender(
      <SkillStrengthCard
        summary={{ ...summary, unratedCount: 0 }}
        rosterHref="/c/fc-test/roster"
        onDismiss={() => {}}
      />
    )
    expect(
      screen.queryByText(/players have no ranking/)
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Rank players' })
    ).not.toBeInTheDocument()
  })

  it('calls onDismiss from the dismiss button', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<SkillStrengthCard summary={summary} onDismiss={onDismiss} />)

    await user.click(
      screen.getByRole('button', { name: /dismiss skill balance summary/i })
    )
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
