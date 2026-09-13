import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlayerTile } from './DroppableTeamCard'
import type { User } from '@/types/user'

const joel: User = {
  uid: 'joel',
  email: 'joel@example.com',
  displayName: 'Joel Hawbaker',
  role: 'user',
  jerseyNumber: 10,
  position: 'ST',
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('PlayerTile address autolink guard', () => {
  it('does not expose a contiguous "10 Joel Hawbaker ST" address string', () => {
    const { container } = render(
      <PlayerTile user={joel} teamColor="#f97316" />
    )

    expect(container.textContent).not.toContain('10 Joel Hawbaker ST')
    expect(container.textContent).toContain('Joel Hawbaker')
    expect(screen.getByText((text) => text.includes('1') && text.includes('0'))).toBeTruthy()

    const row = container.firstElementChild as HTMLElement
    expect(row.getAttribute('x-apple-data-detectors')).toBe('false')
  })
})
