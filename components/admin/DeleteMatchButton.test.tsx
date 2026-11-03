import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DeleteMatchButton } from './DeleteMatchButton'

const deleteMatchAPIMock = vi.fn()
vi.mock('@/lib/api/client', () => ({
  deleteMatchAPI: (...args: unknown[]) => deleteMatchAPIMock(...args),
}))

const match = { id: 'match1', date: new Date(2030, 0, 10, 19, 30) }

describe('DeleteMatchButton', () => {
  beforeEach(() => deleteMatchAPIMock.mockReset())

  it('names the match it deletes for screen readers', () => {
    render(<DeleteMatchButton match={match} />)
    expect(
      screen.getByRole('button', {
        name: 'Delete match on Thursday, Jan 10',
      })
    ).toBeInTheDocument()
  })

  it('deletes only after confirming, then reports back', async () => {
    const user = userEvent.setup()
    const onDeleted = vi.fn()
    deleteMatchAPIMock.mockResolvedValueOnce(undefined)
    render(<DeleteMatchButton match={match} onDeleted={onDeleted} />)

    await user.click(screen.getByRole('button', { name: /delete match on/i }))
    expect(deleteMatchAPIMock).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce())
    expect(deleteMatchAPIMock).toHaveBeenCalledWith('match1')
  })

  it('keeps the match when the dialog is cancelled', async () => {
    const user = userEvent.setup()
    render(<DeleteMatchButton match={match} />)
    await user.click(screen.getByRole('button', { name: /delete match on/i }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(deleteMatchAPIMock).not.toHaveBeenCalled()
  })
})
