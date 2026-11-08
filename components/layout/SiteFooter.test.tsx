import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SiteFooter } from './SiteFooter'

describe('SiteFooter', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the Studio Artemis LLC copyright for the current year', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-03-01T12:00:00Z'))
    render(<SiteFooter />)
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      '© 2027 Studio Artemis LLC. All rights reserved.'
    )
  })
})
