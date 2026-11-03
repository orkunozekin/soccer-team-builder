import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProfileBadge } from './ProfileBadge'

describe('ProfileBadge', () => {
  it('shows the jersey number and links to the profile', () => {
    render(<ProfileBadge displayName="Orkun O." jerseyNumber={10} />)
    const link = screen.getByRole('link', { name: 'Your profile' })
    expect(link).toHaveAttribute('href', '/profile')
    expect(link).toHaveTextContent('10')
  })

  it('falls back to initials without a jersey number', () => {
    render(<ProfileBadge displayName="Orkun Ozekin" jerseyNumber={null} />)
    expect(
      screen.getByRole('link', { name: 'Your profile' })
    ).toHaveTextContent('OO')
  })
})
