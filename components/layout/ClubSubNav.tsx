'use client'

import { CheckIcon, ChevronDownIcon } from '@radix-ui/react-icons'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

  const displayClubId = displayClub.id

  const roleLabel = (role: string) =>
    role === 'club_admin' ? 'club_admin' : 'player'

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

        {/* Mobile: club select + section select */}
        <div className="flex flex-col gap-2 sm:hidden">
          <Select
            value={
              activeMemberships.some(m => m.clubId === displayClubId)
                ? displayClubId
                : undefined
            }
            disabled={switching}
            onValueChange={value => {
              void switchClub(value)
            }}
          >
            <SelectTrigger
              aria-label="Current club"
              className="h-11 w-full rounded-lg border-zinc-200 bg-white font-semibold dark:border-zinc-800 dark:bg-zinc-950"
            >
              <SelectValue placeholder={displayClub.name} />
            </SelectTrigger>
            <SelectContent>
              {activeMemberships.map(m => (
                <SelectItem key={m.clubId} value={m.clubId}>
                  {m.club.name} ({roleLabel(m.role)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {sections.length > 0 && (
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
          )}

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <Link
              href="/join"
              className="font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-300"
            >
              Join a club
            </Link>
            {showCreateClub && (
              <Link
                href="/admin/users"
                className="font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-300"
              >
                Create club
              </Link>
            )}
          </div>
        </div>

        {/* Desktop: switcher + section links */}
        <div className="hidden items-center gap-4 sm:flex">
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={switching}
              className="inline-flex h-9 max-w-[14rem] items-center gap-1 rounded-md px-2 text-sm font-semibold text-zinc-900 outline-none hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-60 dark:text-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Switch club"
            >
              <span className="truncate">{displayClub.name}</span>
              <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[14rem]">
              <DropdownMenuLabel>Your clubs</DropdownMenuLabel>
              {activeMemberships.map(m => {
                const current = m.clubId === displayClubId
                return (
                  <DropdownMenuItem
                    key={m.clubId}
                    disabled={switching}
                    onSelect={() => {
                      void switchClub(m.clubId)
                    }}
                    className="cursor-pointer"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">
                        {m.club.name}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {roleLabel(m.role)}
                      </span>
                    </span>
                    {current && <CheckIcon className="ml-2 h-4 w-4 shrink-0" />}
                  </DropdownMenuItem>
                )
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={() => router.push('/join')}
              >
                Join a club
              </DropdownMenuItem>
              {showCreateClub && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onSelect={() => router.push('/admin/users')}
                >
                  Create club
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
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
