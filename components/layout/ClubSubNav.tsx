'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ClubContextSwitcher } from '@/components/layout/ClubContextSwitcher'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/lib/hooks/useAuth'
import { useClubWorkspace } from '@/lib/hooks/useClubWorkspace'
import { cn } from '@/lib/utils'

/**
 * Club-scoped sub-nav under the Soccerville platform bar.
 * Signed-in only; parent layout should not mount this when logged out.
 */
export function ClubSubNav() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const {
    status,
    displayClub,
    displayRole,
    activeMemberships,
    sections,
    activeSectionHref,
    switching,
    switchError,
    showCreateClub,
    switchClub,
  } = useClubWorkspace()

  if (authLoading || !user || status.kind === 'hidden') return null

  if (status.kind === 'loading') {
    return (
      <div className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="container mx-auto px-4 py-2.5">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Loading clubs…
          </p>
        </div>
      </div>
    )
  }

  if (status.kind === 'error') {
    return (
      <nav
        aria-label="Club"
        className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40"
      >
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <p className="text-sm text-red-700 dark:text-red-400">
            {status.message}
          </p>
          <button
            type="button"
            onClick={status.onRetry}
            className="text-sm font-semibold text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
          >
            Try again
          </button>
        </div>
      </nav>
    )
  }

  if (status.kind === 'empty' || !displayClub) {
    return (
      <nav
        aria-label="Club"
        className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40"
      >
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-2.5">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            You are not in a club yet.
          </p>
          <Link
            href="/join"
            className="text-sm font-semibold text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
          >
            Join a club
          </Link>
        </div>
      </nav>
    )
  }

  return (
    <nav
      aria-label="Club"
      className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <div className="container mx-auto px-4 py-2">
        {switchError && (
          <p
            role="alert"
            className="mb-2 text-sm text-red-700 dark:text-red-400"
          >
            {switchError}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <ClubContextSwitcher
            clubName={displayClub.name}
            role={displayRole}
            clubId={displayClub.id}
            memberships={activeMemberships}
            switching={switching}
            showCreateClub={showCreateClub}
            onSwitch={clubId => {
              void switchClub(clubId)
            }}
            className="min-h-11 sm:min-h-0 sm:w-56"
          />

          {/* Mobile: section select */}
          {sections.length > 0 && (
            <div className="sm:hidden">
              <Select
                value={activeSectionHref}
                onValueChange={href => {
                  if (href !== activeSectionHref) router.push(href)
                }}
              >
                <SelectTrigger
                  aria-label="Club sections"
                  className="h-11 w-full rounded-lg border-zinc-200 bg-white font-semibold dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sections.map(section => (
                    <SelectItem key={section.id} value={section.href}>
                      {section.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Desktop: section links */}
          <div className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto sm:flex">
            {sections.map(section => {
              const active = section.href === activeSectionHref
              return (
                <Link
                  key={section.id}
                  href={section.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                    active
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
                      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                  )}
                >
                  {section.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
