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

  it('uses theme tokens instead of hard-coded hex colors', () => {
    const { rerender } = render(<StatusPill tone="live">Live</StatusPill>)
    expect(screen.getByText('Live').parentElement).toHaveClass(
      'border-live-pill-border',
      'bg-live-pill',
      'text-live-text'
    )
    rerender(<StatusPill tone="success">In</StatusPill>)
    expect(screen.getByText('In').parentElement).toHaveClass(
      'border-ok-pill-border',
      'bg-ok-pill',
      'text-lime'
    )
    rerender(<StatusPill tone="neutral">Closed</StatusPill>)
    expect(screen.getByText('Closed').parentElement).toHaveClass('text-mist')
    expect(screen.getByText('Closed').parentElement.className).not.toMatch(
      /\[#/
    )
  })
})
