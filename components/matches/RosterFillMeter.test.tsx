import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RosterFillMeter } from './RosterFillMeter'

describe('RosterFillMeter', () => {
  it('labels the bar with filled vs total spots', () => {
    render(<RosterFillMeter confirmed={18} />)
    const bar = screen.getByRole('img', { name: '18 of 22 spots filled' })
    const segments = bar.querySelectorAll('span')
    expect(segments).toHaveLength(22)
    expect(bar.querySelectorAll('[data-filled="true"]')).toHaveLength(18)
    expect(screen.getByText('4 spots to fill 2 teams')).toBeInTheDocument()
  })

  it('grows to the next team when two are full', () => {
    render(<RosterFillMeter confirmed={25} />)
    expect(
      screen.getByRole('img', { name: '25 of 33 spots filled' })
    ).toBeInTheDocument()
  })
})
