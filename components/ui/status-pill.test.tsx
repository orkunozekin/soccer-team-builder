import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusPill } from './status-pill'

describe('StatusPill', () => {
  it('renders its label', () => {
    render(<StatusPill tone="neutral">RSVP closed</StatusPill>)
    expect(screen.getByText('RSVP closed')).toBeInTheDocument()
  })

  it('adds a decorative live dot only for the live tone', () => {
    const { rerender } = render(<StatusPill tone="live">RSVP open</StatusPill>)
    expect(screen.getByTestId('status-pill-dot')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
    rerender(<StatusPill tone="muted">RSVP closed</StatusPill>)
    expect(screen.queryByTestId('status-pill-dot')).not.toBeInTheDocument()
  })
})
