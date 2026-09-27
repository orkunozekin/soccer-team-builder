'use client'

import { useEffect, useState } from 'react'
import { CheckIcon, ChevronDownIcon } from '@radix-ui/react-icons'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  clubChromeBorderClass,
  clubChromeFgClass,
  clubChromeFillClass,
  clubChromeHoverClass,
  clubDisplayName,
} from '@/lib/utils/clubBranding'
import { formatMembershipRole } from '@/lib/utils/roleLabels'
import type { ClubMembershipRole, ClubMembershipWithClub } from '@/types/club'

/** Show the find field once the membership list is long enough to scan. */
const CLUB_SEARCH_MIN = 5

function ClubLogo({ url }: { url?: string }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [url])

  if (!url || failed) return null

  return (
    // Club logos are arbitrary https URLs, not files in this app.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="h-8 w-8 shrink-0 rounded-sm bg-white object-contain"
      onError={() => setFailed(true)}
    />
  )
}

export function ClubContextSwitcher({
  clubName,
  logoUrl,
  role,
  clubId,
  memberships,
  switching,
  showCreateClub,
  onSwitch,
  className,
}: {
  clubName: string
  logoUrl?: string
  role: ClubMembershipRole
  clubId: string
  memberships: ClubMembershipWithClub[]
  switching: boolean
  showCreateClub: boolean
  onSwitch: (clubId: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  // Controlled close does not go through onOpenChange, so clear the filter here too.
  const closeSwitcher = () => {
    setOpen(false)
    setQuery('')
  }
  const active = memberships.filter(m => m.status === 'active')
  const showSearch = active.length >= CLUB_SEARCH_MIN
  const needle = query.trim().toLowerCase()
  const filtered = needle
    ? active.filter(m => {
        const label = clubDisplayName(m.club).toLowerCase()
        return (
          label.includes(needle) || m.club.name.toLowerCase().includes(needle)
        )
      })
    : active

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        setOpen(next)
        if (!next) setQuery('')
      }}
    >
      <PopoverTrigger
        disabled={switching}
        aria-label="Switch club"
        className={cn(
          'inline-flex w-full min-w-0 items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--club-foreground)] disabled:opacity-60',
          clubChromeBorderClass,
          clubChromeFillClass,
          clubChromeFgClass,
          clubChromeHoverClass,
          className
        )}
      >
        <ClubLogo url={logoUrl} />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{clubName}</span>
          <span
            className={cn(
              'block truncate text-xs font-normal',
              clubChromeFgClass
            )}
          >
            {formatMembershipRole(role)}
          </span>
        </span>
        <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-70" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        {showSearch ? (
          <div className="border-b border-zinc-200 p-2 dark:border-zinc-800">
            <Input
              autoFocus
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Find club…"
              aria-label="Find club"
            />
          </div>
        ) : null}
        <ul className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <li className="px-2 py-3 text-sm text-zinc-500 dark:text-zinc-400">
              No clubs match.
            </li>
          ) : (
            filtered.map(membership => {
              const current = membership.clubId === clubId
              return (
                <li key={membership.clubId}>
                  <button
                    type="button"
                    disabled={switching}
                    onClick={() => {
                      closeSwitcher()
                      onSwitch(membership.clubId)
                    }}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-zinc-100 disabled:opacity-60 dark:hover:bg-zinc-800"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {clubDisplayName(membership.club)}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {formatMembershipRole(membership.role)}
                      </span>
                    </span>
                    {current ? (
                      <CheckIcon className="h-4 w-4 shrink-0" aria-hidden />
                    ) : null}
                  </button>
                </li>
              )
            })
          )}
        </ul>
        <div className="flex flex-col border-t border-zinc-200 p-1 dark:border-zinc-800">
          <Link
            href="/join"
            onClick={() => closeSwitcher()}
            className="rounded-sm px-2 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Join a club
          </Link>
          {showCreateClub ? (
            <Link
              href="/admin/users"
              onClick={() => closeSwitcher()}
              className="rounded-sm px-2 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Create club
            </Link>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
