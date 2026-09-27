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
    refreshMock.mockResolvedValue(undefined)
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

  it('resets the checkbox when clubId or initial value changes', () => {
    const { rerender } = render(
      <ClubSettingsPanel
        clubId="c1"
        clubName="Alpha FC"
        initialAllowPlayerInvites={false}
      />
    )
    expect(screen.getByRole('checkbox')).not.toBeChecked()

    rerender(
      <ClubSettingsPanel
        clubId="c2"
        clubName="Beta FC"
        initialAllowPlayerInvites={true}
      />
    )
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('saves branding and rejects a non-https logo before calling the API', async () => {
    const user = userEvent.setup()
    refreshMock.mockResolvedValue(undefined)
    vi.mocked(updateClubAPI).mockResolvedValue({
      success: true,
      club: {} as never,
    })

    const { rerender } = render(
      <ClubSettingsPanel
        clubId="c1"
        clubName="Alpha FC"
        initialAllowPlayerInvites={false}
        initialBranding={{ displayName: 'Wolves' }}
      />
    )

    expect(screen.getByLabelText('Display name')).toHaveValue('Wolves')
    await user.clear(screen.getByLabelText('Logo URL'))
    await user.type(
      screen.getByLabelText('Logo URL'),
      'http://cdn.example/a.png'
    )
    await user.click(screen.getByRole('button', { name: 'Save branding' }))

    expect(updateClubAPI).not.toHaveBeenCalled()
    expect(
      await screen.findByText('Logo URL must be an https URL')
    ).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Logo URL'))
    await user.type(
      screen.getByLabelText('Logo URL'),
      'https://cdn.example/logo.png'
    )
    await user.clear(screen.getByLabelText('Primary color'))
    await user.type(screen.getByLabelText('Primary color'), '#112233')
    await user.click(screen.getByRole('button', { name: 'Save branding' }))

    await waitFor(() => {
      expect(updateClubAPI).toHaveBeenCalledWith('c1', {
        settings: {
          branding: {
            displayName: 'Wolves',
            logoUrl: 'https://cdn.example/logo.png',
            primaryColor: '#112233',
          },
        },
      })
    })
    expect(await screen.findByText('Saved.')).toBeInTheDocument()

    rerender(
      <ClubSettingsPanel
        clubId="c1"
        clubName="Alpha FC"
        initialAllowPlayerInvites={false}
        initialBranding={{
          displayName: 'Wolves',
          logoUrl: 'https://cdn.example/logo.png',
          primaryColor: '#112233',
        }}
      />
    )
    expect(screen.getByText('Saved.')).toBeInTheDocument()
  })
})
