import { type ReactNode, useContext } from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Deferred = {
  promise: Promise<void>
  resolve: () => void
  reject: (error: Error) => void
}

function deferred(): Deferred {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const authState = vi.hoisted(() => ({
  user: null as { uid: string; email: string | null } | null,
  loading: false,
}))
const ld = vi.hoisted(() => ({
  init: null as Deferred | null,
  flags: {} as Record<string, unknown>,
}))

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => authState,
}))

vi.mock('launchdarkly-react-client-sdk', () => {
  const client = {
    waitForInitialization: () => ld.init!.promise,
    allFlags: () => ld.flags,
    identify: () => new Promise(() => {}),
    on: () => {},
    off: () => {},
  }
  return {
    LDProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    useLDClient: () => client,
  }
})

async function loadProvider() {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_LAUNCHDARKLY_CLIENT_ID', 'test-client-id')
  const { LaunchDarklyProvider } = await import('./LaunchDarklyProvider')
  const { FeatureFlagContext, FeatureFlagsReadyContext } =
    await import('./FeatureFlagContext')
  function Probe() {
    const flags = useContext(FeatureFlagContext)
    const ready = useContext(FeatureFlagsReadyContext)
    return (
      <span data-testid="probe">
        {`${ready ? 'ready' : 'loading'}:${flags['light-theme'] ? 'on' : 'off'}`}
      </span>
    )
  }
  return function Tree() {
    return (
      <LaunchDarklyProvider>
        <Probe />
      </LaunchDarklyProvider>
    )
  }
}

const probe = () => screen.getByTestId('probe').textContent

beforeEach(() => {
  authState.user = { uid: 'u1', email: 'u1@example.com' }
  authState.loading = false
  ld.init = deferred()
  ld.flags = {}
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('LaunchDarklyProvider readiness', () => {
  it('is not ready until LD initializes, then exposes the flag', async () => {
    const Tree = await loadProvider()
    render(<Tree />)
    expect(probe()).toBe('loading:off')

    ld.flags = { 'light-theme': true }
    await act(async () => ld.init!.resolve())

    expect(probe()).toBe('ready:on')
  })

  it('counts an LD init failure as ready with flags off (fail-closed)', async () => {
    const Tree = await loadProvider()
    render(<Tree />)
    expect(probe()).toBe('loading:off')

    await act(async () => ld.init!.reject(new Error('timeout')))

    expect(probe()).toBe('ready:off')
  })

  it('is not ready again after an account switch until LD answers for the new user', async () => {
    const Tree = await loadProvider()
    const { rerender } = render(<Tree />)
    await act(async () => ld.init!.resolve())
    expect(probe()).toBe('ready:off')

    ld.init = deferred()
    authState.user = { uid: 'u2', email: 'u2@example.com' }
    rerender(<Tree />)
    expect(probe()).toBe('loading:off')

    await act(async () => ld.init!.resolve())
    expect(probe()).toBe('ready:off')
  })

  it('falls back to ready if the LD client never settles', async () => {
    vi.useFakeTimers()
    const Tree = await loadProvider()
    render(<Tree />)
    expect(probe()).toBe('loading:off')

    await act(async () => {
      vi.advanceTimersByTime(12_000)
    })

    expect(probe()).toBe('ready:off')
  })

  it('does not carry the previous user’s flags into a failed init for the next user', async () => {
    const Tree = await loadProvider()
    const { rerender } = render(<Tree />)
    ld.flags = { 'light-theme': true }
    await act(async () => ld.init!.resolve())
    expect(probe()).toBe('ready:on')

    ld.init = deferred()
    authState.user = { uid: 'u2', email: 'u2@example.com' }
    rerender(<Tree />)
    // u1's value must not be visible while u2 is evaluated…
    expect(probe()).toBe('loading:off')

    // …nor certified as u2's when u2's init fails.
    await act(async () => ld.init!.reject(new Error('timeout')))
    expect(probe()).toBe('ready:off')
  })

  it('does not certify the previous user’s flags via the fallback timer', async () => {
    vi.useFakeTimers()
    const Tree = await loadProvider()
    const { rerender } = render(<Tree />)
    ld.flags = { 'light-theme': true }
    await act(async () => ld.init!.resolve())
    expect(probe()).toBe('ready:on')

    ld.init = deferred()
    authState.user = { uid: 'u2', email: 'u2@example.com' }
    rerender(<Tree />)
    await act(async () => {
      vi.advanceTimersByTime(12_000)
    })

    expect(probe()).toBe('ready:off')
  })
})
