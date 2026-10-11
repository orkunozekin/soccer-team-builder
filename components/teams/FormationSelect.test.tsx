import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FormationSelect } from './FormationSelect'

const applyFormationAPIMock = vi.fn()

vi.mock('@/lib/api/client', () => ({
  applyFormationAPI: (...args: unknown[]) => applyFormationAPIMock(...args),
}))

beforeAll(() => {
  Object.assign(HTMLElement.prototype, {
    hasPointerCapture: () => false,
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    scrollIntoView: () => {},
  })
})

describe('FormationSelect', () => {
  beforeEach(() => {
    applyFormationAPIMock.mockReset()
  })

  it('calls applyFormationAPI and onApplied when a formation is chosen', async () => {
    const user = userEvent.setup()
    const onApplied = vi.fn()
    applyFormationAPIMock.mockResolvedValueOnce({
      success: true,
      formationId: '4-3-3',
      teamsUpdated: 2,
      positionsChanged: 4,
      assignments: [],
    })

    render(
      <FormationSelect matchId="m1" onApplied={onApplied} value={null} />
    )

    await user.click(screen.getByLabelText('Select team formation'))
    await user.click(await screen.findByRole('option', { name: '4-3-3' }))

    await waitFor(() => {
      expect(applyFormationAPIMock).toHaveBeenCalledWith('m1', '4-3-3')
    })
    expect(onApplied).toHaveBeenCalledWith('4-3-3')
  })

  it('shows an error and restores prior value when the API fails', async () => {
    const user = userEvent.setup()
    applyFormationAPIMock.mockRejectedValueOnce(new Error('Nope'))

    render(<FormationSelect matchId="m1" value="4-4-2" />)

    await user.click(screen.getByLabelText('Select team formation'))
    await user.click(await screen.findByRole('option', { name: '3-5-2' }))

    expect(await screen.findByText('Nope')).toBeInTheDocument()
    expect(screen.getByLabelText('Select team formation')).toHaveTextContent(
      '4-4-2'
    )
  })
})
