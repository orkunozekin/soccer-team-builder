import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { User as FirebaseUser } from 'firebase/auth'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { ThemeToggle } from './ThemeToggle'
import {
  FeatureFlagContext,
  FeatureFlagsReadyContext,
} from '@/components/flags/FeatureFlagContext'
import {
  THEME_STORAGE_KEY,
  ThemeProvider,
} from '@/components/providers/ThemeProvider'
import { ThemeSync } from '@/components/providers/ThemeSync'
import { updateProfileAPI } from '@/lib/api/client'
import { useAuthStore } from '@/store/authStore'
import { resetThemeSaveStore } from '@/store/themeSaveStore'
import type { ThemePreference, User } from '@/types/user'

vi.mock('@/lib/api/client', () => ({
  updateProfileAPI: vi.fn(),
}))

const updateProfile = vi.mocked(updateProfileAPI)

function firebaseUser(uid: string): FirebaseUser {
  return { uid, email: `${uid}@example.com` } as FirebaseUser
}

function profile(uid: string, themePreference?: ThemePreference): User {
  return {
    uid,
    email: `${uid}@example.com`,
    displayName: uid,
    jerseyNumber: null,
    position: null,
    role: 'user',
    themePreference,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }
}

function signIn(uid: string, themePreference?: ThemePreference) {
  useAuthStore.setState({
    user: firebaseUser(uid),
    userData: profile(uid, themePreference),
    loading: false,
    profileReady: true,
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function Harness({
  flagOn = true,
  flagReady = true,
  toggles = 1,
}: {
  flagOn?: boolean
  flagReady?: boolean
  /** How many toggles are mounted (rail + sheet = 2; sheet closed = 0). */
  toggles?: number
}) {
  return (
    <ThemeProvider>
      <FeatureFlagContext.Provider value={{ 'light-theme': flagOn }}>
        <FeatureFlagsReadyContext.Provider value={flagReady}>
          <ThemeSync />
          {Array.from({ length: toggles }, (_, i) => (
            <div key={i} data-testid={`toggle-${i}`}>
              <ThemeToggle />
            </div>
          ))}
        </FeatureFlagsReadyContext.Provider>
      </FeatureFlagContext.Provider>
    </ThemeProvider>
  )
}

const htmlClasses = () => document.documentElement.classList

function expectTheme(theme: ThemePreference) {
  const other = theme === 'dark' ? 'light' : 'dark'
  expect(htmlClasses()).toContain(theme)
  expect(htmlClasses()).not.toContain(other)
  expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe(theme)
}

const darkButton = () => screen.getByRole('button', { name: 'Dark theme' })
const lightButton = () => screen.getByRole('button', { name: 'Light theme' })

beforeAll(() => {
  // next-themes subscribes to prefers-color-scheme; jsdom has no matchMedia.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
})

beforeEach(() => {
  vi.clearAllMocks()
  resetThemeSaveStore()
  window.localStorage.clear()
  document.documentElement.className = ''
  signIn('u1')
})

afterEach(() => {
  document.documentElement.className = ''
})

describe('ThemeToggle', () => {
  it('is hidden when the flag is off', () => {
    render(<Harness flagOn={false} />)
    expect(
      screen.queryByRole('group', { name: 'Theme' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Light theme' })
    ).not.toBeInTheDocument()
  })

  it('is hidden while the flags are still loading', () => {
    render(<Harness flagReady={false} />)
    expect(
      screen.queryByRole('group', { name: 'Theme' })
    ).not.toBeInTheDocument()
  })

  it('shows both buttons with the current theme pressed', async () => {
    render(<Harness />)

    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument()
    await waitFor(() =>
      expect(darkButton()).toHaveAttribute('aria-pressed', 'true')
    )
    expect(lightButton()).toHaveAttribute('aria-pressed', 'false')
  })

  it('reflects a stored light preference', async () => {
    signIn('u1', 'light')
    render(<Harness />)

    await waitFor(() =>
      expect(lightButton()).toHaveAttribute('aria-pressed', 'true')
    )
    expect(darkButton()).toHaveAttribute('aria-pressed', 'false')
    // Active state carries an edge as well as a fill, so it does not rely on
    // two similar fills alone (light theme on the rail).
    expect(lightButton()).toHaveClass('bg-toggle-active')
    expect(lightButton().className).toMatch(/shadow-\[inset_0_0_0_1px_/)
    expect(darkButton()).not.toHaveClass('bg-toggle-active')
  })

  it('switches to light at once, saves it, then updates the profile', async () => {
    const user = userEvent.setup()
    const save = deferred<{ success: boolean }>()
    updateProfile.mockReturnValue(save.promise)
    render(<Harness />)
    await waitFor(() => expectTheme('dark'))

    await user.click(lightButton())

    // Applied before the save resolves.
    expectTheme('light')
    expect(lightButton()).toHaveAttribute('aria-pressed', 'true')
    expect(updateProfile).toHaveBeenCalledWith({ themePreference: 'light' })
    expect(useAuthStore.getState().userData?.themePreference).toBeUndefined()

    await act(async () => {
      save.resolve({ success: true })
    })

    expect(useAuthStore.getState().userData?.themePreference).toBe('light')
    expect(useAuthStore.getState().userData?.displayName).toBe('u1')
    expectTheme('light')
    expect(lightButton()).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('disables both buttons while saving', async () => {
    const user = userEvent.setup()
    const save = deferred<{ success: boolean }>()
    updateProfile.mockReturnValue(save.promise)
    render(<Harness />)
    await waitFor(() =>
      expect(darkButton()).toHaveAttribute('aria-pressed', 'true')
    )

    await user.click(lightButton())

    expect(darkButton()).toBeDisabled()
    expect(lightButton()).toBeDisabled()
    expect(screen.getByRole('group', { name: 'Theme' })).toHaveAttribute(
      'aria-busy',
      'true'
    )

    await act(async () => {
      save.resolve({ success: true })
    })
    expect(darkButton()).toBeEnabled()
    expect(lightButton()).toBeEnabled()
  })

  it('reverts to dark and shows a sanitized alert when the save fails', async () => {
    const user = userEvent.setup()
    updateProfile.mockRejectedValue(
      new Error('FirebaseError: PERMISSION_DENIED at users/u1')
    )
    render(<Harness />)
    await waitFor(() => expectTheme('dark'))

    await user.click(lightButton())

    await waitFor(() => expectTheme('dark'))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Couldn’t save your theme. Try again.')
    expect(alert).not.toHaveTextContent(/firebase|permission/i)
    expect(darkButton()).toHaveAttribute('aria-pressed', 'true')
    expect(darkButton()).toBeEnabled()
    expect(useAuthStore.getState().userData?.themePreference).toBeUndefined()
  })

  it('clears the alert on the next successful switch', async () => {
    const user = userEvent.setup()
    updateProfile.mockRejectedValueOnce(new Error('nope'))
    updateProfile.mockResolvedValueOnce({ success: true })
    render(<Harness />)
    await waitFor(() => expectTheme('dark'))

    await user.click(lightButton())
    await screen.findByRole('alert')

    await user.click(lightButton())
    await waitFor(() =>
      expect(useAuthStore.getState().userData?.themePreference).toBe('light')
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expectTheme('light')
  })

  it('ignores a stale response after the account changes', async () => {
    const user = userEvent.setup()
    const save = deferred<{ success: boolean }>()
    updateProfile.mockReturnValue(save.promise)
    render(<Harness />)
    await waitFor(() => expectTheme('dark'))

    await user.click(lightButton())
    expectTheme('light')

    // Another account signs in (its profile prefers dark) before u1's save
    // lands.
    act(() => signIn('u2', 'dark'))
    await waitFor(() => expectTheme('dark'))
    expect(lightButton()).toBeEnabled()

    await act(async () => {
      save.resolve({ success: true })
    })

    expect(useAuthStore.getState().userData).toMatchObject({
      uid: 'u2',
      themePreference: 'dark',
    })
    expectTheme('dark')
  })

  it('does not revert the new account’s theme when a stale save fails', async () => {
    const user = userEvent.setup()
    const save = deferred<{ success: boolean }>()
    updateProfile.mockReturnValue(save.promise)
    render(<Harness />)
    await waitFor(() => expectTheme('dark'))

    await user.click(lightButton())
    act(() => signIn('u2', 'light'))
    await waitFor(() => expectTheme('light'))

    await act(async () => {
      save.reject(new Error('network'))
    })

    expectTheme('light')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not revert the new account’s theme when a save fails after its toggle unmounted', async () => {
    const user = userEvent.setup()
    const save = deferred<{ success: boolean }>()
    updateProfile.mockReturnValue(save.promise)
    const { rerender } = render(<Harness />)
    await waitFor(() => expectTheme('dark'))

    await user.click(lightButton())
    expectTheme('light')

    // The mobile sheet closes (toggle unmounts), then another account signs in.
    rerender(<Harness toggles={0} />)
    act(() => signIn('u2', 'light'))
    await waitFor(() => expectTheme('light'))

    await act(async () => {
      save.reject(new Error('network'))
    })

    expectTheme('light')
    expect(useAuthStore.getState().userData).toMatchObject({
      uid: 'u2',
      themePreference: 'light',
    })
  })

  it('shares the pending save between the rail and sheet toggles', async () => {
    const user = userEvent.setup()
    const save = deferred<{ success: boolean }>()
    updateProfile.mockReturnValue(save.promise)
    render(<Harness toggles={2} />)
    const rail = within(screen.getByTestId('toggle-0'))
    const sheet = within(screen.getByTestId('toggle-1'))
    await waitFor(() =>
      expect(rail.getByRole('button', { name: 'Dark theme' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    )

    await user.click(rail.getByRole('button', { name: 'Light theme' }))

    expect(sheet.getByRole('button', { name: 'Dark theme' })).toBeDisabled()
    expect(sheet.getByRole('button', { name: 'Light theme' })).toBeDisabled()
    expect(sheet.getByRole('button', { name: 'Light theme' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await act(async () => {
      save.resolve({ success: true })
    })
    expect(sheet.getByRole('button', { name: 'Dark theme' })).toBeEnabled()
    expect(updateProfile).toHaveBeenCalledOnce()
  })

  it('keeps a remounted toggle busy until the earlier save settles', async () => {
    const user = userEvent.setup()
    const first = deferred<{ success: boolean }>()
    updateProfile.mockReturnValueOnce(first.promise)
    updateProfile.mockResolvedValueOnce({ success: true })
    const { rerender } = render(<Harness />)
    await waitFor(() => expectTheme('dark'))

    await user.click(lightButton())
    // Sheet closes and reopens while the Light save is still pending.
    rerender(<Harness toggles={0} />)
    rerender(<Harness />)

    await waitFor(() =>
      expect(lightButton()).toHaveAttribute('aria-pressed', 'true')
    )
    expect(darkButton()).toBeDisabled()
    await user.click(darkButton())
    expect(updateProfile).toHaveBeenCalledOnce()

    await act(async () => {
      first.resolve({ success: true })
    })
    expect(useAuthStore.getState().userData?.themePreference).toBe('light')

    await user.click(darkButton())
    await waitFor(() =>
      expect(useAuthStore.getState().userData?.themePreference).toBe('dark')
    )
    expectTheme('dark')
  })

  it('shows a failed save’s alert only for the account it belongs to', async () => {
    const user = userEvent.setup()
    updateProfile.mockRejectedValue(new Error('nope'))
    render(<Harness />)
    await waitFor(() => expectTheme('dark'))

    await user.click(lightButton())
    await screen.findByRole('alert')

    act(() => signIn('u2'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('ends dark when the flag turns off while a failing save is pending', async () => {
    const user = userEvent.setup()
    const save = deferred<{ success: boolean }>()
    updateProfile.mockReturnValue(save.promise)
    signIn('u1', 'light')
    const { rerender } = render(<Harness />)
    await waitFor(() => expectTheme('light'))

    await user.click(darkButton())
    expectTheme('dark')

    // LD turns the flag off mid-save; ThemeSync already forces dark.
    rerender(<Harness flagOn={false} />)
    await waitFor(() => expectTheme('dark'))

    await act(async () => {
      save.reject(new Error('network'))
    })

    await waitFor(() => expectTheme('dark'))
    // Give a stray rollback a chance to land.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })
    expectTheme('dark')
  })
})
