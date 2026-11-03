'use client'

import { useState } from 'react'
import { HamburgerMenuIcon } from '@radix-ui/react-icons'
import Link from 'next/link'
import { AccountMenu } from '@/components/layout/AccountMenu'
import { AccountNav } from '@/components/layout/AccountNav'
import {
  ClubContextSwitcher,
  type ClubSwitcherVariant,
} from '@/components/layout/ClubContextSwitcher'
import { ClubNav } from '@/components/layout/ClubNav'
import { ClubWorkspaceStatus } from '@/components/layout/ClubWorkspaceStatus'
import { Navigation } from '@/components/layout/Navigation'
import { PlatformAdminNav } from '@/components/layout/PlatformAdminNav'
import { ProfileBadge } from '@/components/layout/ProfileBadge'
import { Wordmark } from '@/components/layout/Wordmark'
import { NavLoadingSkeleton } from '@/components/LoadingSkeleton'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { useAuth } from '@/lib/hooks/useAuth'
import { useClubWorkspace } from '@/lib/hooks/useClubWorkspace'
import { clubMatchesPath } from '@/lib/utils/clubPaths'

/**
 * Signed-in workspace: club switcher + club/admin/account nav (desktop rail,
 * mobile sheet) and a sign-out footer. Signed-out users keep the centered header.
 */
export function AppShell({ children }: { children?: React.ReactNode }) {
  const { user, userData, loading } = useAuth()
  const { isAdmin } = useAdmin()
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

  const renderSwitcher = (variant: ClubSwitcherVariant) =>
    club ? (
      <ClubContextSwitcher
        variant={variant}
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
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col self-start border-r border-line/60 bg-rail text-chalk md:flex">
        <div className="px-5 pb-4 pt-6">
          <Link
            href={brandHref}
            aria-label="Soccerville"
            className="rounded-md text-chalk outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Wordmark />
          </Link>
        </div>
        <div className="px-4">{renderSwitcher('card')}</div>
        <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 px-3 pb-3">
            {club ? (
              <ClubNav
                sections={workspace.sections}
                activeHref={workspace.activeSectionHref}
              />
            ) : null}
            {isAdmin ? <PlatformAdminNav /> : null}
          </div>
          <div className="mt-auto flex flex-col gap-3 border-t border-line/60 p-4">
            <AccountNav className="-mx-1" />
            <AccountMenu />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line/60 bg-rail/95 px-3 py-2 text-chalk backdrop-blur md:hidden">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open club menu"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line/60 bg-turf text-chalk outline-none hover:bg-turf-raised focus-visible:ring-2 focus-visible:ring-ring"
              >
                <HamburgerMenuIcon className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-[19rem] flex-col gap-0 border-line/60 bg-rail p-0 text-chalk"
            >
              <SheetHeader className="px-5 py-5 pr-12 text-left">
                <SheetTitle className="text-chalk">
                  <Link
                    href={brandHref}
                    aria-label="Soccerville"
                    onClick={() => setSheetOpen(false)}
                  >
                    <Wordmark />
                  </Link>
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Club navigation
                </SheetDescription>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <div className="flex flex-col gap-4 px-3 py-2">
                  {club ? (
                    <ClubNav
                      sections={workspace.sections}
                      activeHref={workspace.activeSectionHref}
                      onNavigate={() => setSheetOpen(false)}
                    />
                  ) : (
                    <div className="px-1">
                      <ClubWorkspaceStatus
                        status={workspace.status}
                        onNavigate={() => setSheetOpen(false)}
                      />
                    </div>
                  )}
                  {isAdmin ? (
                    <PlatformAdminNav onNavigate={() => setSheetOpen(false)} />
                  ) : null}
                </div>
                <div className="mt-auto flex flex-col gap-3 border-t border-line/60 p-4">
                  <AccountNav
                    className="-mx-1"
                    onNavigate={() => setSheetOpen(false)}
                  />
                  <AccountMenu onNavigate={() => setSheetOpen(false)} />
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">{renderSwitcher('inline')}</div>
          <ProfileBadge
            displayName={userData?.displayName}
            jerseyNumber={userData?.jerseyNumber}
          />
        </header>
        {workspace.switchError ? (
          <p role="alert" className="px-4 pt-3 text-sm text-flare">
            {workspace.switchError}
          </p>
        ) : null}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
