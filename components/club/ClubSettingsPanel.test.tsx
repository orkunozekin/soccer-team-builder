import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClubSettingsPanel } from './ClubSettingsPanel'
import { updateClubAPI } from '@/lib/api/client'

const refreshMock = vi.fn()

vi.mock('@/lib/api/client', () => ({
  updateClubAPI: vi.fn(),
}))

vi.mock('@/lib/hooks/useClubMemberships', () => ({
  useClubMemberships: () => ({ refresh: refreshMock }),
}))

describe('ClubSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('toggles allowPlayerInvites via PATCH', async () => {
    const user = userEvent.setup()
    vi.mocked(updateClubAPI).mockResolvedValue({
      success: true,
      club: {} as never,
    })

    render(
      <ClubSettingsPanel
        clubId="c1"
        clubName="Alpha FC"
        initialAllowPlayerInvites={false}
      />
    )

    await user.click(screen.getByRole('checkbox'))

    await waitFor(() => {
      expect(updateClubAPI).toHaveBeenCalledWith('c1', {
        settings: { allowPlayerInvites: true },
      })
    })
    expect(refreshMock).toHaveBeenCalled()
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })

  it('keeps the new value when refresh fails after a successful save', async () => {
    const user = userEvent.setup()
    vi.mocked(updateClubAPI).mockResolvedValue({
      success: true,
      club: {} as never,
    })
    refreshMock.mockRejectedValue(new Error('Network down'))

    render(
      <ClubSettingsPanel
        clubId="c1"
        clubName="Alpha FC"
        initialAllowPlayerInvites={false}
      />
    )

    await user.click(screen.getByRole('checkbox'))

    expect(
      await screen.findByText(/Saved, but failed to refresh clubs/i)
    ).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeChecked()
  })
})
