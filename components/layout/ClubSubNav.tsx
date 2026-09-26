'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CheckIcon, ChevronDownIcon } from '@radix-ui/react-icons'
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
import { useAdmin } from '@/lib/hooks/useAdmin'
import { useAuth } from '@/lib/hooks/useAuth'
import { useClubMemberships } from '@/lib/hooks/useClubMemberships'
import { useFeatureFlag } from '@/lib/flags/useFeatureFlag'
import { updateProfileAPI } from '@/lib/api/client'
import { useAuthStore } from '@/store/authStore'
import {
  clubSubNavSections,
  resolveSelectedClubMembership,
} from '@/lib/utils/resolveSelectedClub'
import { cn } from '@/lib/utils'

/**
 * Club-scoped sub-nav under the Soccerville platform bar.
 * Signed-in only; parent layout should not mount this when logged out.
 */
export function ClubSubNav() {
  const { user, userData, loading: authLoading } = useAuth()
  const { isSuperUser } = useAdmin()
  const setUserData = useAuthStore(state => state.setUserData)
  const { memberships, loading: membershipsLoading } = useClubMemberships()
  const clubCreationEnabled = useFeatureFlag('club-creation')
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const [switching, setSwitching] = useState(false)

  const selected = useMemo(
    () =>
      resolveSelectedClubMembership({
        memberships,
        activeClubId: userData?.activeClubId,
      }),
    [memberships, userData?.activeClubId]
  )

  const sections = useMemo(() => {
    if (!selected) return []
    return clubSubNavSections({
      slug: selected.club.slug,
      role: selected.role,
      allowPlayerInvites: selected.club.settings.allowPlayerInvites,
      isSuperUser: !!isSuperUser,
    })
  }, [selected, isSuperUser])

  const activeSectionHref =
    sections.find(s => {
      if (s.id === 'matches') {
        return pathname === '/matches' || pathname.startsWith('/matches/')
      }
      return pathname === s.href || pathname.startsWith(`${s.href}/`)
    })?.href ?? sections[0]?.href

  if (authLoading || !user) return null

  if (membershipsLoading && memberships.length === 0) {
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

  if (!selected) {
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

  const switchClub = async (clubId: string) => {
    if (!userData || clubId === selected.clubId || switching) return
    const next = memberships.find(
      m => m.clubId === clubId && m.status === 'active'
    )
    if (!next) return

    setSwitching(true)
    try {
      await updateProfileAPI({ activeClubId: clubId })
      setUserData({ ...userData, activeClubId: clubId })

      // Until slug routes exist, keep the user on Matches after a switch when
      // they were on a club-admin section they may no longer open.
      const nextSections = clubSubNavSections({
        slug: next.club.slug,
        role: next.role,
        allowPlayerInvites: next.club.settings.allowPlayerInvites,
        isSuperUser: !!isSuperUser,
      })
      const currentId = sections.find(s => s.href === activeSectionHref)?.id
      const canStay =
        currentId && nextSections.some(s => s.id === currentId && s.id !== 'matches')
      if (canStay && currentId) {
        const href = nextSections.find(s => s.id === currentId)?.href
        if (href) {
          router.push(href)
          return
        }
      }
      if (pathname !== '/matches') {
        router.push('/matches')
      }
    } catch (err) {
      console.error('Failed to switch club:', err)
    } finally {
      setSwitching(false)
    }
  }

  const roleLabel = (role: string) =>
    role === 'club_admin' ? 'club_admin' : 'player'

  return (
    <nav
      aria-label="Club"
      className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <div className="container mx-auto px-4 py-2">
        {/* Mobile: club select + section select */}
        <div className="flex flex-col gap-2 sm:hidden">
          <Select
            value={selected.clubId}
            disabled={switching}
            onValueChange={value => {
              void switchClub(value)
            }}
          >
            <SelectTrigger
              aria-label="Current club"
              className="h-11 w-full rounded-lg border-zinc-200 bg-white font-semibold dark:border-zinc-800 dark:bg-zinc-950"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {memberships
                .filter(m => m.status === 'active')
                .map(m => (
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
            {clubCreationEnabled && isSuperUser && (
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
              <span className="truncate">{selected.club.name}</span>
              <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[14rem]">
              <DropdownMenuLabel>Your clubs</DropdownMenuLabel>
              {memberships
                .filter(m => m.status === 'active')
                .map(m => {
                  const current = m.clubId === selected.clubId
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
                      {current && (
                        <CheckIcon className="ml-2 h-4 w-4 shrink-0" />
                      )}
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
              {clubCreationEnabled && isSuperUser && (
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
