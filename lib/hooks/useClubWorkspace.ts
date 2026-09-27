'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { updateProfileAPI } from '@/lib/api/client'
import { useFeatureFlag } from '@/lib/flags/useFeatureFlag'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { useAuth } from '@/lib/hooks/useAuth'
import { useClubMemberships } from '@/lib/hooks/useClubMemberships'
import { useClubSlugAccess } from '@/lib/hooks/useClubSlugAccess'
import {
  clubMatchesPath,
  parseClubSlugFromPathname,
  resolveClubMembershipForPath,
} from '@/lib/utils/clubPaths'
import { clubSubNavSections } from '@/lib/utils/resolveSelectedClub'
import type { ClubSubNavSection } from '@/lib/utils/resolveSelectedClub'
import { useAuthStore } from '@/store/authStore'
import type { ClubMembershipRole } from '@/types/club'

export type ClubWorkspaceStatus =
  | { kind: 'hidden' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string; onRetry: () => void }
  | { kind: 'empty' }
  | { kind: 'ready' }

export type ClubWorkspaceClub = {
  id: string
  name: string
  slug: string
  settings: { allowPlayerInvites: boolean }
}

export type ClubWorkspaceSection = {
  id: ClubSubNavSection
  label: string
  href: string
}

function isPlatformPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/clubs') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/join') ||
    pathname.startsWith('/forgot-password')
  )
}

/**
 * Selected club, section links, and switch handler for club chrome.
 * Membership resolution stays in `resolveClubMembershipForPath` /
 * `clubSubNavSections` — do not fork a second list.
 */
export function useClubWorkspace() {
  const { user, userData } = useAuth()
  const { isSuperUser } = useAdmin()
  const setUserData = useAuthStore(state => state.setUserData)
  const {
    memberships,
    loading: membershipsLoading,
    error: membershipsError,
    refresh,
  } = useClubMemberships()
  const clubCreationEnabled = useFeatureFlag('club-creation')
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const [switching, setSwitching] = useState(false)
  const [switchError, setSwitchError] = useState('')

  const pathSlug = parseClubSlugFromPathname(pathname)

  const membershipSelected = useMemo(
    () =>
      resolveClubMembershipForPath({
        memberships,
        activeClubId: userData?.activeClubId,
        pathSlug,
      }),
    [memberships, userData?.activeClubId, pathSlug]
  )

  const pathMembership = useMemo(() => {
    if (!pathSlug) return null
    return (
      memberships.find(
        m => m.status === 'active' && m.club.slug === pathSlug
      ) ?? null
    )
  }, [memberships, pathSlug])

  // Super users can open a club they are not a member of; resolve that path
  // club so the shell matches the URL instead of another membership.
  const needsPathClub = Boolean(isSuperUser && pathSlug && !pathMembership)
  const pathAccess = useClubSlugAccess(
    needsPathClub ? (pathSlug ?? undefined) : undefined
  )

  const displayClub: ClubWorkspaceClub | null =
    pathMembership?.club ??
    (pathAccess.status === 'ok' ? pathAccess.club : null) ??
    membershipSelected?.club ??
    null

  const displayClubId =
    pathMembership?.clubId ??
    (pathAccess.status === 'ok' ? pathAccess.club.id : null) ??
    membershipSelected?.clubId ??
    null

  const displayRole: ClubMembershipRole =
    pathMembership?.role ??
    (pathAccess.status === 'ok' ? 'club_admin' : membershipSelected?.role) ??
    'player'

  const sections = useMemo(() => {
    if (!displayClub) return []
    return clubSubNavSections({
      slug: displayClub.slug,
      role: displayRole,
      allowPlayerInvites: displayClub.settings.allowPlayerInvites,
      isSuperUser: !!isSuperUser,
    })
  }, [displayClub, displayRole, isSuperUser])

  const activeSectionHref =
    sections.find(s => {
      if (s.id === 'matches') {
        return (
          pathname === s.href ||
          pathname.startsWith(`${s.href}/`) ||
          pathname === '/matches' ||
          pathname.startsWith('/matches/')
        )
      }
      return pathname === s.href || pathname.startsWith(`${s.href}/`)
    })?.href

  const activeMemberships = useMemo(
    () => memberships.filter(m => m.status === 'active'),
    [memberships]
  )

  const status: ClubWorkspaceStatus = (() => {
    if (!user) return { kind: 'hidden' }
    if (membershipsLoading && memberships.length === 0)
      return { kind: 'loading' }
    if (membershipsError && memberships.length === 0 && !needsPathClub) {
      return {
        kind: 'error',
        message: `Could not load clubs. ${membershipsError}`,
        onRetry: () => {
          void refresh()
        },
      }
    }
    if (needsPathClub && pathAccess.status === 'loading') {
      return { kind: 'loading' }
    }
    if (needsPathClub && pathAccess.status === 'error') {
      return {
        kind: 'error',
        message: `Could not load club. ${pathAccess.message}`,
        onRetry: () => pathAccess.retry(),
      }
    }
    if (!displayClub || !displayClubId) return { kind: 'empty' }
    return { kind: 'ready' }
  })()

  const switchClub = async (clubId: string) => {
    if (!userData || !displayClubId || clubId === displayClubId || switching) {
      return
    }
    const next = activeMemberships.find(m => m.clubId === clubId)
    if (!next) return

    setSwitching(true)
    setSwitchError('')
    try {
      await updateProfileAPI({ activeClubId: clubId })
      setUserData({ ...userData, activeClubId: clubId })

      // Stay on platform pages (profile/admin/auth). On club sections, keep
      // the same section when the new role allows it; otherwise land on Matches.
      if (isPlatformPath(pathname)) return

      const nextSections = clubSubNavSections({
        slug: next.club.slug,
        role: next.role,
        allowPlayerInvites: next.club.settings.allowPlayerInvites,
        isSuperUser: !!isSuperUser,
      })
      const currentId = sections.find(s => s.href === activeSectionHref)?.id
      const canStay =
        currentId &&
        nextSections.some(s => s.id === currentId && s.id !== 'matches')
      if (canStay && currentId) {
        const href = nextSections.find(s => s.id === currentId)?.href
        if (href) {
          router.push(href)
          return
        }
      }

      const nextMatches = clubMatchesPath(next.club.slug)
      if (pathname !== nextMatches) {
        router.push(nextMatches)
      }
    } catch (err) {
      console.error('Failed to switch club:', err)
      setSwitchError(
        err instanceof Error ? err.message : 'Failed to switch club'
      )
    } finally {
      setSwitching(false)
    }
  }

  return {
    status,
    displayClub,
    displayRole,
    activeMemberships,
    sections,
    activeSectionHref,
    switching,
    switchError,
    showCreateClub: Boolean(clubCreationEnabled && isSuperUser),
    switchClub,
  }
}
