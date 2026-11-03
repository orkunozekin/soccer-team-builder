import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User as FirebaseUser } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileCompleteModal } from './ProfileCompleteModal'
import { updateProfileAPI } from '@/lib/api/client'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types/user'

vi.mock('@/lib/api/client', () => ({
  updateProfileAPI: vi.fn(),
}))

const profile: User = {
  uid: 'u1',
  email: 'u1@example.com',
  displayName: 'Pat Player',
  jerseyNumber: 7,
  position: 'Defender',
  role: 'user',
  createdAt: new Date(0),
  updatedAt: new Date(0),
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({
    user: { uid: 'u1', email: 'u1@example.com' } as FirebaseUser,
    userData: profile,
    loading: false,
    profileReady: true,
  })
})

function renderModal() {
  const onOpenChange = vi.fn()
  render(<ProfileCompleteModal open onOpenChange={onOpenChange} />)
  return { onOpenChange }
}

describe('ProfileCompleteModal', () => {
  it('keeps in-progress edits when the theme is saved meanwhile', async () => {
    const user = userEvent.setup()
    renderModal()
    const name = screen.getByLabelText(/display name/i)
    await user.clear(name)
    await user.type(name, 'Pat Edited')

    act(() => {
      useAuthStore.getState().mergeUserData('u1', { themePreference: 'light' })
    })

    expect(name).toHaveValue('Pat Edited')
  })

  it('keeps a theme saved while its submit was in flight', async () => {
    const user = userEvent.setup()
    let finishSubmit!: (value: { success: boolean }) => void
    vi.mocked(updateProfileAPI).mockReturnValue(
      new Promise(resolve => {
        finishSubmit = resolve
      })
    )
    const { onOpenChange } = renderModal()
    const name = screen.getByLabelText(/display name/i)
    await user.clear(name)
    await user.type(name, 'Pat Edited')
    await user.click(screen.getByRole('button', { name: /save and continue/i }))

    act(() => {
      useAuthStore.getState().mergeUserData('u1', { themePreference: 'light' })
    })
    await act(async () => {
      finishSubmit({ success: true })
    })

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(useAuthStore.getState().userData).toMatchObject({
      displayName: 'Pat Edited',
      position: 'Defender',
      themePreference: 'light',
    })
  })
})
