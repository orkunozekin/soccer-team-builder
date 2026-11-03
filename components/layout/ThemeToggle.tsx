'use client'

import { useEffect, useRef, useState } from 'react'
import { type LucideIcon, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { updateProfileAPI } from '@/lib/api/client'
import { useFeatureFlag, useFeatureFlagReady } from '@/lib/flags/useFeatureFlag'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { type ThemePreference, normalizeThemePreference } from '@/types/user'

const OPTIONS: { value: ThemePreference; label: string; Icon: LucideIcon }[] = [
  { value: 'dark', label: 'Dark theme', Icon: Moon },
  { value: 'light', label: 'Light theme', Icon: Sun },
]

const SAVE_ERROR = 'Couldn’t save your theme. Try again.'

/**
 * Icon-only Dark / Light switch for the account footer.
 *
 * Renders as siblings (group + optional alert) so the parent row's
 * `flex-wrap` can drop the alert onto its own line under the username.
 * Applies the theme at once, then saves it to the profile; on failure it
 * reverts. `ThemeSync` only re-applies when the saved preference changes, so
 * the optimistic `setTheme` here is not undone while the save is in flight.
 */
export function ThemeToggle() {
  const flagOn = useFeatureFlag('light-theme')
  const flagReady = useFeatureFlagReady('light-theme')
  const { theme, setTheme } = useTheme()
  const uid = useAuthStore(state => state.user?.uid ?? null)
  const [mounted, setMounted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Bumped per click and on account switch; a response only lands if its
  // request is still the latest one.
  const requestRef = useRef(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    requestRef.current += 1
    setSaving(false)
    setError(null)
  }, [uid])

  if (!flagOn || !flagReady) return null

  // next-themes doesn't know the theme during SSR; only show which button is
  // pressed once mounted so server and client markup match.
  const current = mounted ? normalizeThemePreference(theme) : null

  const select = async (next: ThemePreference) => {
    if (saving || !current || next === current || !uid) return
    const previous = current
    const requestId = ++requestRef.current
    setError(null)
    setSaving(true)
    setTheme(next)
    try {
      await updateProfileAPI({ themePreference: next })
      if (requestId !== requestRef.current) return
      const { user, userData, setUserData } = useAuthStore.getState()
      if (user?.uid === uid && userData?.uid === uid) {
        setUserData({ ...userData, themePreference: next })
      }
    } catch {
      if (requestId !== requestRef.current) return
      setTheme(previous)
      setError(SAVE_ERROR)
    } finally {
      if (requestId === requestRef.current) setSaving(false)
    }
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
              onClick={() => {
                void select(value)
              }}
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
