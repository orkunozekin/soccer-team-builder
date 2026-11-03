import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User as FirebaseUser } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileForm } from './ProfileForm'
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
  position: null,
  role: 'user',
  createdAt: new Date(0),
  updatedAt: new Date(0),
}

beforeEach(() => {
  useAuthStore.setState({
    user: { uid: 'u1', email: 'u1@example.com' } as FirebaseUser,
    userData: profile,
    loading: false,
    profileReady: true,
  })
})

describe('ProfileForm', () => {
  it('keeps unsaved edits when an unrelated profile field (theme) changes', async () => {
    const user = userEvent.setup()
    render(<ProfileForm />)
    const name = screen.getByLabelText(/name/i)
    const jersey = screen.getByLabelText(/jersey/i)

    await user.clear(name)
    await user.type(name, 'Pat Edited')
    await user.clear(jersey)
    await user.type(jersey, '9')

    act(() => {
      const { userData, setUserData } = useAuthStore.getState()
      setUserData({ ...userData!, themePreference: 'light' })
    })

    expect(name).toHaveValue('Pat Edited')
    expect(jersey).toHaveValue(9)
  })

  it('syncs the form when a saved profile field changes', async () => {
    const user = userEvent.setup()
    render(<ProfileForm />)
    const name = screen.getByLabelText(/name/i)
    await user.clear(name)
    await user.type(name, 'Unsaved')

    act(() => {
      const { userData, setUserData } = useAuthStore.getState()
      setUserData({ ...userData!, displayName: 'Renamed Elsewhere' })
    })

    expect(name).toHaveValue('Renamed Elsewhere')
  })

  it('keeps a theme saved while the profile submit was in flight', async () => {
    const user = userEvent.setup()
    let finishSubmit!: (value: { success: boolean }) => void
    vi.mocked(updateProfileAPI).mockReturnValue(
      new Promise(resolve => {
        finishSubmit = resolve
      })
    )
    render(<ProfileForm />)
    const name = screen.getByLabelText(/name/i)
    await user.clear(name)
    await user.type(name, 'Pat Edited')
    await user.click(screen.getByRole('button', { name: /update profile/i }))

    // The sidebar theme save lands before the profile request returns.
    act(() => {
      useAuthStore.getState().mergeUserData('u1', { themePreference: 'light' })
    })
    await act(async () => {
      finishSubmit({ success: true })
    })

    expect(useAuthStore.getState().userData).toMatchObject({
      displayName: 'Pat Edited',
      jerseyNumber: 7,
      themePreference: 'light',
    })
  })
})
