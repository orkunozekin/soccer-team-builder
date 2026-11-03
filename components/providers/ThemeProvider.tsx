'use client'

import type { ReactNode } from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export const THEME_STORAGE_KEY = 'sv-theme'

/**
 * App-wide theme runtime. next-themes injects an inline script that applies
 * the cached `sv-theme` class to <html> before first paint; with nothing
 * cached it falls back to dark. `ThemeSync` makes the signed-in user's
 * profile the source of truth once it loads.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      themes={['dark', 'light']}
      defaultTheme="dark"
      enableSystem={false}
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
