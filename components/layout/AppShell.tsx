'use client'

import { useState } from 'react'
import { HamburgerMenuIcon } from '@radix-ui/react-icons'
import Link from 'next/link'
import { AccountMenu } from '@/components/layout/AccountMenu'
import { ClubContextSwitcher } from '@/components/layout/ClubContextSwitcher'
import { ClubNav } from '@/components/layout/ClubNav'
import { ClubWorkspaceStatus } from '@/components/layout/ClubWorkspaceStatus'
import { Navigation } from '@/components/layout/Navigation'
import { NavLoadingSkeleton } from '@/components/LoadingSkeleton'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAuth } from '@/lib/hooks/useAuth'
import { useClubWorkspace } from '@/lib/hooks/useClubWorkspace'
import { clubMatchesPath } from '@/lib/utils/clubPaths'

/**
 * Signed-in workspace: club switcher + club nav (desktop rail, mobile sheet)
 * and a separate account menu. Signed-out users keep the centered header.
 */
export function AppShell({ children }: { children?: React.ReactNode }) {
  const { user, loading } = useAuth()
  const workspace = useClubWorkspace()
  const [sheetOpen, setSheetOpen] = useState(false)

  if (loading) {
    return (
      <>
        <div className="sticky top-0 z-20 mb-4">
          <NavLoadingSkeleton />
        </div>
        {children}
      </>
    )
  }

  if (!user) {
    return (
      <>
        <div className="sticky top-0 z-20 mb-4">
          <Navigation />
        </div>
        {children}
      </>
    )
  }

  const club = workspace.status.kind === 'ready' ? workspace.displayClub : null
  const brandHref = club ? clubMatchesPath(club.slug) : '/join'

  const switcher = club ? (
    <ClubContextSwitcher
      clubName={club.name}
      role={workspace.displayRole}
      clubId={club.id}
      memberships={workspace.activeMemberships}
      switching={workspace.switching}
      showCreateClub={workspace.showCreateClub}
      onSwitch={clubId => {
        void workspace.switchClub(clubId)
      }}
    />
  ) : (
    <ClubWorkspaceStatus status={workspace.status} />
  )

  return (
    <div className="flex min-h-dvh w-full">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col self-start border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 md:flex">
        <div className="px-4 pb-2 pt-4">
          <Link href={brandHref} className="text-sm font-bold text-red-50">
            Soccerville
          </Link>
        </div>
        <div className="px-3">{switcher}</div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2">
          {club ? (
            <ClubNav
              sections={workspace.sections}
              activeHref={workspace.activeSectionHref}
            />
          ) : null}
        </div>
        <div className="mt-auto border-t border-zinc-200 p-3 dark:border-zinc-800">
          <AccountMenu className="w-full max-w-none justify-between" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-2 py-2 dark:border-zinc-800 dark:bg-zinc-950 md:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open club menu"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-zinc-900 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                <HamburgerMenuIcon className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-72 flex-col gap-0 p-0">
              <SheetHeader className="border-b border-zinc-200 px-4 py-4 pr-12 text-left dark:border-zinc-800">
                <SheetTitle className="text-sm font-bold text-red-50">
                  <Link href={brandHref} onClick={() => setSheetOpen(false)}>
                    Soccerville
                  </Link>
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Club navigation
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-2 py-3">
                {club ? (
                  <ClubNav
                    sections={workspace.sections}
                    activeHref={workspace.activeSectionHref}
                    onNavigate={() => setSheetOpen(false)}
                  />
                ) : (
                  <div className="px-1">
                    <ClubWorkspaceStatus status={workspace.status} />
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">{switcher}</div>
          <AccountMenu className="shrink-0" />
        </header>
        {workspace.switchError ? (
          <p
            role="alert"
            className="px-4 pt-3 text-sm text-red-700 dark:text-red-400"
          >
            {workspace.switchError}
          </p>
        ) : null}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
