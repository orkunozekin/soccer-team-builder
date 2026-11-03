import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FilterPill, FilterPillGroup } from './filter-pill'

describe('FilterPill', () => {
  it('is a non-submitting button that reflects its active state', async () => {
    const onClick = vi.fn()
    render(
      <FilterPillGroup role="group" aria-label="Filter">
        <FilterPill active aria-pressed onClick={onClick}>
          All
        </FilterPill>
        <FilterPill active={false} aria-pressed={false}>
          Past
        </FilterPill>
      </FilterPillGroup>
    )
    const all = screen.getByRole('button', { name: 'All' })
    expect(all).toHaveAttribute('type', 'button')
    expect(all).toHaveAttribute('data-active', 'true')
    expect(screen.getByRole('button', { name: 'Past' })).toHaveAttribute(
      'data-active',
      'false'
    )
    await userEvent.click(all)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
