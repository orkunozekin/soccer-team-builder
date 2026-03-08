import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AdminMatchCard } from './AdminMatchCard'
import type { Match } from '@/types/match'

const deleteMatchAPIMock = vi.fn()

vi.mock('@/lib/api/client', () => ({
  deleteMatchAPI: (...args: unknown[]) => deleteMatchAPIMock(...args),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: (props: any) => <a href={props.href}>{props.children}</a>,
}))

const baseMatch: Match = {
  id: 'match1',
  date: new Date('2024-01-01T19:00:00Z'),
  time: '19:00',
  location: 'Test field',
  rsvpOpen: true,
  rsvpOpenAt: null,
  rsvpCloseAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('AdminMatchCard', () => {
  it('renders date, time, location, RSVP badge and headcount', () => {
    render(<AdminMatchCard match={baseMatch} rsvpCount={3} />)

    expect(screen.getByText(/test field/i)).toBeInTheDocument()
    expect(screen.getByText(/rsvp open/i)).toBeInTheDocument()
    expect(screen.getByText(/3 players confirmed/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  it('confirms and deletes match, then calls onDeleted', async () => {
    const user = userEvent.setup()
    deleteMatchAPIMock.mockResolvedValueOnce(undefined)
    const onDeleted = vi.fn()

    render(<AdminMatchCard match={baseMatch} onDeleted={onDeleted} />)

    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    const confirmButton = await screen.findByRole('button', {
      name: /delete/i,
    })
    await user.click(confirmButton)

    expect(deleteMatchAPIMock).toHaveBeenCalledWith('match1')
    expect(onDeleted).toHaveBeenCalledTimes(1)
  })
})
