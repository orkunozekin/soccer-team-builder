'use client'

import { useState } from 'react'
import { HamburgerMenuIcon } from '@radix-ui/react-icons'
import Link from 'next/link'
import { AccountMenu } from '@/components/layout/AccountMenu'
import { ClubContextSwitcher } from '@/components/layout/ClubContextSwitcher'
import { ClubNav } from '@/components/layout/ClubNav'
import { ClubWorkspaceStatus } from '@/components/layout/ClubWorkspaceStatus'
import { Navigation } from '@/components/layout/Navigation'
import { PlatformAdminNav } from '@/components/layout/PlatformAdminNav'
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
import { cn } from '@/lib/utils'
import {
  clubChromeBorderClass,
  clubChromeEdgeClass,
  clubChromeFgClass,
  clubChromeHoverClass,
  clubChromeStyle,
  clubDisplayName,
} from '@/lib/utils/clubBranding'
import { clubMatchesPath } from '@/lib/utils/clubPaths'

/**
 * Signed-in workspace: club switcher + club nav (desktop rail, mobile sheet)
 * and a separate account menu. Signed-out users keep the centered header.
 */
export function AppShell({ children }: { children?: React.ReactNode }) {
  const { user, loading } = useAuth()
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

  const chromeStyle = clubChromeStyle(club?.settings.branding?.primaryColor)

  const switcher = club ? (
    <ClubContextSwitcher
      clubName={clubDisplayName(club)}
      logoUrl={club.settings.branding?.logoUrl}
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
      <aside
        style={chromeStyle}
        className={cn(
          'sticky top-0 hidden h-dvh w-60 shrink-0 flex-col self-start border-r md:flex',
          clubChromeEdgeClass
        )}
      >
        <div className="px-4 pb-2 pt-4">
          <Link
            href={brandHref}
            className={cn(
              'text-sm font-bold hover:opacity-80',
              clubChromeFgClass
            )}
          >
            Soccerville
          </Link>
        </div>
        <div className="px-3">{switcher}</div>
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2">
          {club ? (
            <ClubNav
              sections={workspace.sections}
              activeHref={workspace.activeSectionHref}
            />
          ) : null}
          {isAdmin ? <PlatformAdminNav /> : null}
        </div>
        <div className={cn('mt-auto border-t p-3', clubChromeBorderClass)}>
          <AccountMenu className="w-full max-w-none justify-between" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          style={chromeStyle}
          className={cn(
            'sticky top-0 z-20 flex items-center gap-2 border-b px-2 py-2 shadow-md md:hidden',
            clubChromeEdgeClass
          )}
        >
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open club menu"
                className={cn(
                  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md',
                  clubChromeFgClass,
                  clubChromeHoverClass
                )}
              >
                <HamburgerMenuIcon className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              style={chromeStyle}
              className={cn(
                'flex w-72 flex-col gap-0 border-r p-0',
                clubChromeEdgeClass
              )}
            >
              <SheetHeader
                className={cn(
                  'border-b px-4 py-4 pr-12 text-left',
                  clubChromeEdgeClass
                )}
              >
                <SheetTitle
                  className={cn('text-sm font-bold', clubChromeFgClass)}
                >
                  <Link href={brandHref} onClick={() => setSheetOpen(false)}>
                    Soccerville
                  </Link>
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Club navigation
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-3">
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
              <div
                className={cn('mt-auto border-t p-3', clubChromeBorderClass)}
              >
                <AccountMenu onNavigate={() => setSheetOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">{switcher}</div>
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
