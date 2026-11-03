'use client'

import { useEffect, useState } from 'react'
import { type LucideIcon, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useFeatureFlag, useFeatureFlagReady } from '@/lib/flags/useFeatureFlag'
import { saveThemePreference } from '@/lib/theme/saveThemePreference'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useThemeSaveStore } from '@/store/themeSaveStore'
import { type ThemePreference, normalizeThemePreference } from '@/types/user'

const OPTIONS: { value: ThemePreference; label: string; Icon: LucideIcon }[] = [
  { value: 'dark', label: 'Dark theme', Icon: Moon },
  { value: 'light', label: 'Light theme', Icon: Sun },
]

/**
 * Icon-only Dark / Light switch for the account footer.
 *
 * Renders as siblings (group + optional alert) so the parent row's
 * `flex-wrap` can drop the alert onto its own line under the username.
 * Applies the theme at once, then saves it to the profile; on failure it
 * reverts. `ThemeSync` only re-applies when the saved preference changes, so
 * the optimistic `setTheme` here is not undone while the save is in flight.
 *
 * Save state (busy, error, request ordering) lives in `themeSaveStore` (written by `saveThemePreference`), shared
 * by the rail and sheet toggles and kept across unmounts.
 */
export function ThemeToggle() {
  const flagOn = useFeatureFlag('light-theme')
  const flagReady = useFeatureFlagReady('light-theme')
  const { theme, setTheme } = useTheme()
  const uid = useAuthStore(state => state.user?.uid ?? null)
  const saving = useThemeSaveStore(
    state => uid !== null && state.pendingUid === uid
  )
  const error = useThemeSaveStore(state =>
    uid !== null && state.error?.uid === uid ? state.error.message : null
  )
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!flagOn || !flagReady) return null

  // next-themes doesn't know the theme during SSR; only show which button is
  // pressed once mounted so server and client markup match.
  const current = mounted ? normalizeThemePreference(theme) : null

  const select = (next: ThemePreference) => {
    if (saving || !current || next === current || !uid) return
    void saveThemePreference({ uid, next, previous: current, setTheme })
  }

  return (
    <>
      <div
        role="group"
        aria-label="Theme"
        aria-busy={saving || undefined}
        className="inline-flex shrink-0 items-center rounded-full border border-line p-0.5"
      >
        {OPTIONS.map(({ value, label, Icon }) => {
          const pressed = current === value
          return (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={current ? pressed : undefined}
              disabled={saving}
              onClick={() => select(value)}
              className={cn(
                'inline-flex h-11 w-11 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait',
                pressed
                  ? 'bg-turf-raised text-chalk'
                  : 'text-mist hover:text-chalk'
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </button>
          )
        })}
      </div>
      {error ? (
        <p role="alert" className="basis-full px-1 text-xs text-flare">
          {error}
        </p>
      ) : null}
    </>
  )
}
