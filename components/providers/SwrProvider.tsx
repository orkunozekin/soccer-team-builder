'use client'

import { SWRConfig } from 'swr'

/**
 * App-wide SWR defaults for server-state caching.
 * Keep Zustand for auth / local UI; use SWR for shared fetch caches.
 */
export function SwrProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        // Avoid surprise refetches while an admin is mid-flow on a form.
        revalidateOnFocus: false,
        shouldRetryOnError: false,
      }}
    >
      {children}
    </SWRConfig>
  )
}
