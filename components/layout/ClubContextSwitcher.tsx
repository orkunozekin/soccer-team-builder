'use client'

import { useState } from 'react'
import { CheckIcon, ChevronDownIcon } from '@radix-ui/react-icons'
import Link from 'next/link'
import { ClubBadge } from '@/components/layout/ClubBadge'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { formatMembershipRole } from '@/lib/utils/roleLabels'
import type { ClubMembershipRole, ClubMembershipWithClub } from '@/types/club'

/** Show the find field once the membership list is long enough to scan. */
const CLUB_SEARCH_MIN = 5

/**
 * - `card` (desktop rail): boxed trigger with badge, club name and your role.
 * - `inline` (mobile header): borderless badge, club name and chevron.
 */
export type ClubSwitcherVariant = 'card' | 'inline'

const TRIGGER_CLASS: Record<ClubSwitcherVariant, string> = {
  card: 'w-full gap-3 rounded-xl border border-line/70 bg-turf px-3 py-2 hover:bg-turf-raised',
  inline: 'max-w-full gap-2.5 rounded-xl px-1 py-1 hover:bg-turf/60',
}

export function ClubContextSwitcher({
  clubName,
  role,
  clubId,
  memberships,
  switching,
  showCreateClub,
  onSwitch,
  variant = 'card',
  className,
}: {
  clubName: string
  role: ClubMembershipRole
  clubId: string
  memberships: ClubMembershipWithClub[]
  switching: boolean
  showCreateClub: boolean
  onSwitch: (clubId: string) => void
  variant?: ClubSwitcherVariant
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
    ? active.filter(m => m.club.name.toLowerCase().includes(needle))
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
          'inline-flex min-h-11 min-w-0 items-center text-left font-semibold text-chalk outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
          TRIGGER_CLASS[variant],
          className
        )}
      >
        <ClubBadge name={clubName} size={variant === 'inline' ? 'sm' : 'md'} />
        {variant === 'card' ? (
          <span className="min-w-0 flex-1 text-sm">
            <span className="block truncate">{clubName}</span>
            <span className="block truncate text-xs font-normal text-fog">
              {formatMembershipRole(role)}
            </span>
          </span>
        ) : (
          <span className="min-w-0 truncate text-[15px]">{clubName}</span>
        )}
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-fog" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        {showSearch ? (
          <div className="border-b border-border p-2">
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
            <li className="px-2 py-3 text-sm text-muted-foreground">
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
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-accent disabled:opacity-60"
                  >
                    <ClubBadge name={membership.club.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {membership.club.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
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
        <div className="flex flex-col border-t border-border p-1">
          <Link
            href="/join"
            onClick={() => closeSwitcher()}
            className="rounded-sm px-2 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Join a club
          </Link>
          {showCreateClub ? (
            <Link
              href="/admin/users"
              onClick={() => closeSwitcher()}
              className="rounded-sm px-2 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Create club
            </Link>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
