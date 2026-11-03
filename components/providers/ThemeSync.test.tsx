import { act, render, waitFor } from '@testing-library/react'
import type { User as FirebaseUser } from 'firebase/auth'
import { useTheme } from 'next-themes'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { THEME_STORAGE_KEY, ThemeProvider } from './ThemeProvider'
import { ThemeSync } from './ThemeSync'
import {
  FeatureFlagContext,
  FeatureFlagsReadyContext,
} from '@/components/flags/FeatureFlagContext'
import { useAuthStore } from '@/store/authStore'
import type { ThemePreference, User } from '@/types/user'

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

let externalSetTheme: ((theme: string) => void) | null = null

/** Stands in for another caller of next-themes (e.g. the step 5 toggle). */
function ExternalThemeControl() {
  externalSetTheme = useTheme().setTheme
  return null
}

function Harness({
  flagOn,
  flagReady = true,
}: {
  flagOn: boolean
  flagReady?: boolean
}) {
  return (
    <ThemeProvider>
      <FeatureFlagContext.Provider value={{ 'light-theme': flagOn }}>
        <FeatureFlagsReadyContext.Provider value={flagReady}>
          <ThemeSync />
          <ExternalThemeControl />
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
  window.localStorage.clear()
  document.documentElement.className = ''
  useAuthStore.setState({
    user: null,
    userData: null,
    loading: false,
    profileReady: false,
  })
})

afterEach(() => {
  document.documentElement.className = ''
})

describe('ThemeSync', () => {
  it('forces dark when the flag is off, even for a stored light preference', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    signIn('u1', 'light')

    render(<Harness flagOn={false} />)

    await waitFor(() => expectTheme('dark'))
  })

  it('applies the stored light preference when the flag is on', async () => {
    signIn('u1', 'light')

    render(<Harness flagOn />)

    await waitFor(() => expectTheme('light'))
  })

  it('falls back to dark when the flag is on and no preference is stored', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    signIn('u1')

    render(<Harness flagOn />)

    await waitFor(() => expectTheme('dark'))
  })

  it('leaves the cached theme alone while flags are still loading', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    signIn('u1')

    const { rerender } = render(<Harness flagOn={false} flagReady={false} />)

    await waitFor(() => expect(htmlClasses()).toContain('light'))
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')

    // Once LD settles (here: off), the user ends up dark.
    rerender(<Harness flagOn={false} flagReady />)
    await waitFor(() => expectTheme('dark'))
  })

  it('leaves the cached theme alone until the profile is ready', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    useAuthStore.setState({
      user: firebaseUser('u1'),
      userData: null,
      profileReady: false,
    })

    render(<Harness flagOn={false} />)

    await waitFor(() => expect(htmlClasses()).toContain('light'))
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('changes nothing while signed out', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')

    render(<Harness flagOn={false} />)

    await waitFor(() => expect(htmlClasses()).toContain('light'))
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('keeps the theme when the user signs out', async () => {
    signIn('u1', 'light')
    render(<Harness flagOn />)
    await waitFor(() => expectTheme('light'))

    act(() => useAuthStore.getState().logout())

    await waitFor(() => expectTheme('light'))
  })

  it('applies the new user’s preference after an account switch, never the stale one', async () => {
    signIn('u1', 'light')
    render(<Harness flagOn />)
    await waitFor(() => expectTheme('light'))

    // AuthProvider sets the new auth user first; the previous user's profile
    // is still in the store until the new fetch lands.
    act(() => {
      useAuthStore.setState({
        user: firebaseUser('u2'),
        userData: profile('u1', 'light'),
        profileReady: true,
      })
    })
    expectTheme('light')

    act(() => {
      useAuthStore.setState({ userData: profile('u2'), profileReady: true })
    })
    await waitFor(() => expectTheme('dark'))

    // Switching back applies u1's light again.
    act(() => {
      useAuthStore.setState({
        user: firebaseUser('u1'),
        userData: profile('u1', 'light'),
        profileReady: true,
      })
    })
    await waitFor(() => expectTheme('light'))
  })

  it('does not apply the previous user’s light preference to a new user', async () => {
    signIn('u1')
    render(<Harness flagOn />)
    await waitFor(() => expectTheme('dark'))

    // u2 is signed in but the store still holds u1's (light) profile.
    act(() => {
      useAuthStore.setState({
        user: firebaseUser('u2'),
        userData: profile('u1', 'light'),
        profileReady: true,
      })
    })

    expectTheme('dark')
  })

  it('does not revert a theme change made elsewhere while its inputs are unchanged', async () => {
    signIn('u1')
    render(<Harness flagOn />)
    await waitFor(() => expectTheme('dark'))

    act(() => externalSetTheme!('light'))

    await waitFor(() => expectTheme('light'))
    // Give any re-run effect a chance to fire.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })
    expectTheme('light')

    // A real input change (the saved preference) still applies.
    act(() => {
      useAuthStore.setState({ userData: profile('u1', 'dark') })
    })
    await waitFor(() => expectTheme('dark'))
  })
})
