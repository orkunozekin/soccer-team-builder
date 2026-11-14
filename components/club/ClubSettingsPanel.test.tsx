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

const invitesCheckbox = () =>
  screen.getByRole('checkbox', { name: /players can invite/i })
const conductCheckbox = () =>
  screen.getByRole('checkbox', { name: /require the code of conduct/i })

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

    await user.click(invitesCheckbox())

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

    await user.click(invitesCheckbox())

    expect(
      await screen.findByText(/Saved, but failed to refresh clubs/i)
    ).toBeInTheDocument()
    expect(invitesCheckbox()).toBeChecked()
  })

  it('resets the checkbox when clubId or initial value changes', () => {
    const { rerender } = render(
      <ClubSettingsPanel
        clubId="c1"
        clubName="Alpha FC"
        initialAllowPlayerInvites={false}
      />
    )
    expect(invitesCheckbox()).not.toBeChecked()

    rerender(
      <ClubSettingsPanel
        clubId="c2"
        clubName="Beta FC"
        initialAllowPlayerInvites={true}
      />
    )
    expect(invitesCheckbox()).toBeChecked()
  })

  it('turns on the code of conduct requirement via PATCH', async () => {
    const user = userEvent.setup()
    vi.mocked(updateClubAPI).mockResolvedValue({
      success: true,
      club: {} as never,
    })
    refreshMock.mockResolvedValue(undefined)

    render(
      <ClubSettingsPanel
        clubId="c1"
        clubName="Alpha FC"
        initialAllowPlayerInvites={true}
        initialRequireCodeOfConduct={false}
      />
    )

    await user.click(conductCheckbox())

    await waitFor(() => {
      expect(updateClubAPI).toHaveBeenCalledWith('c1', {
        settings: { requireCodeOfConduct: true },
      })
    })
    expect(conductCheckbox()).toBeChecked()
    expect(invitesCheckbox()).toBeChecked()
    expect(
      screen.getByRole('link', { name: /code of conduct/i })
    ).toHaveAttribute('href', '/code-of-conduct')
  })

  it('reverts the code of conduct checkbox when the save fails', async () => {
    const user = userEvent.setup()
    vi.mocked(updateClubAPI).mockRejectedValue(new Error('Nope'))

    render(
      <ClubSettingsPanel
        clubId="c1"
        clubName="Alpha FC"
        initialAllowPlayerInvites={false}
        initialRequireCodeOfConduct={true}
      />
    )

    await user.click(conductCheckbox())

    expect(await screen.findByText('Nope')).toBeInTheDocument()
    expect(conductCheckbox()).toBeChecked()
    expect(refreshMock).not.toHaveBeenCalled()
  })
})
