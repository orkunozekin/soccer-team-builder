import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useFeatureFlagReady } from './useFeatureFlag'
import { FeatureFlagsReadyContext } from '@/components/flags/FeatureFlagContext'

function wrapper(ready: boolean) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <FeatureFlagsReadyContext.Provider value={ready}>
        {children}
      </FeatureFlagsReadyContext.Provider>
    )
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('useFeatureFlagReady', () => {
  it('is ready with no provider (LD not configured is fail-closed)', () => {
    const { result } = renderHook(() => useFeatureFlagReady('light-theme'))
    expect(result.current).toBe(true)
  })

  it('reflects the provider while LD is loading', () => {
    expect(
      renderHook(() => useFeatureFlagReady('light-theme'), {
        wrapper: wrapper(false),
      }).result.current
    ).toBe(false)
    expect(
      renderHook(() => useFeatureFlagReady('light-theme'), {
        wrapper: wrapper(true),
      }).result.current
    ).toBe(true)
  })

  it('treats a local NEXT_PUBLIC_FF_* override as ready', () => {
    vi.stubEnv('NEXT_PUBLIC_FF_LIGHT_THEME', 'true')
    const { result } = renderHook(() => useFeatureFlagReady('light-theme'), {
      wrapper: wrapper(false),
    })
    expect(result.current).toBe(true)
  })
})
