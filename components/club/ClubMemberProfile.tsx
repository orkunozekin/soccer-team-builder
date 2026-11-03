'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { positionLabel } from '@/components/admin/PlayerProfileDetails'
import { PlayerRsvpHistory } from '@/components/admin/PlayerRsvpHistory'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { AttendanceStatsCard } from '@/components/profile/AttendanceStatsCard'
import { BackLink } from '@/components/ui/back-link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getClubMemberProfileAPI } from '@/lib/api/client'
import type { ClubMemberProfileDTO } from '@/lib/clubs/clubMemberProfile'
import type { PlayerHistory } from '@/lib/services/playerHistory'
import { clubMatchPath, clubRosterPath } from '@/lib/utils/clubPaths'

type LoadState =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }
  | { status: 'ok'; profile: ClubMemberProfileDTO }

function toPlayerHistory(profile: ClubMemberProfileDTO): PlayerHistory {
  return {
    rsvps: profile.rsvps.map(rsvp => ({
      ...rsvp,
      checkedInAt: rsvp.checkedInAt ? new Date(rsvp.checkedInAt) : null,
      rsvpAt: new Date(rsvp.rsvpAt),
      updatedAt: new Date(rsvp.updatedAt),
    })),
    matches: profile.matches.map(match => ({
      ...match,
      date: new Date(match.date),
    })),
  }
}

/** Club-scoped player page for club admins: profile + this club's RSVPs. */
export function ClubMemberProfile({
  clubId,
  clubSlug,
  userId,
}: {
  clubId: string
  clubSlug: string
  userId: string
}) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    getClubMemberProfileAPI(clubId, userId)
      .then(profile => {
        if (!cancelled) setState({ status: 'ok', profile })
      })
      .catch((err: Error & { status?: number }) => {
        if (cancelled) return
        setState(
          err.status === 404
            ? { status: 'not-found' }
            : { status: 'error', message: err.message }
        )
      })
    return () => {
      cancelled = true
    }
  }, [clubId, userId, attempt])

  const profile = state.status === 'ok' ? state.profile : null
  const history = useMemo(
    () => (profile ? toPlayerHistory(profile) : null),
    [profile]
  )
  const loadHistory = useCallback(
    async () => history ?? { rsvps: [], matches: [] },
    [history]
  )
  const matchHref = useCallback(
    (matchId: string) => clubMatchPath(clubSlug, matchId),
    [clubSlug]
  )

  const backLink = (
    <BackLink href={clubRosterPath(clubSlug)} label="Back to Roster" />
  )

  if (state.status === 'loading') {
    return <PageLoadingSkeleton variant="container" />
  }

  if (state.status === 'error') {
    return (
      <div>
        {backLink}
        <div role="alert" className="mt-4 space-y-3">
          <p className="text-sm text-danger">
            Could not load this member. {state.message}
          </p>
          <Button type="button" onClick={() => setAttempt(n => n + 1)}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (state.status === 'not-found' || !profile) {
    return (
      <div>
        {backLink}
        <div className="mt-8 text-center">
          <h1 className="font-display text-4xl font-black uppercase">
            Member not found
          </h1>
          <p className="mt-2 text-sm text-fog">
            This player may have left the club or the link is invalid.
          </p>
        </div>
      </div>
    )
  }

  const { member } = profile
  return (
    <div>
      {backLink}
      <PageHeader
        size="md"
        className="mt-4"
        eyebrow="Club admin · Member"
        title={member.displayName}
        description="Profile and attendance in this club"
      />
      <div className="space-y-6">
        <Card className="overflow-hidden rounded-xl border-border shadow-sm">
          <CardHeader className="pb-4 sm:px-8 sm:pt-8">
            <CardTitle className="text-2xl sm:text-3xl">
              Player Details
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Profile information on file
            </CardDescription>
          </CardHeader>
          <CardContent className="sm:px-8 sm:pb-8">
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailItem label="Email" wide>
                <span className="break-all">{member.email || '—'}</span>
              </DetailItem>
              <DetailItem label="Jersey">
                {member.jerseyNumber == null ? '—' : member.jerseyNumber}
              </DetailItem>
              <DetailItem label="Position">
                {positionLabel(member.position)}
              </DetailItem>
              <DetailItem label="Club role">
                <Badge
                  variant={
                    member.clubRole === 'club_admin' ? 'default' : 'outline'
                  }
                >
                  {member.clubRole === 'club_admin' ? 'Club admin' : 'Player'}
                </Badge>
              </DetailItem>
              <DetailItem label="Joined club">
                {format(new Date(member.joinedAt), 'MMM d, yyyy')}
              </DetailItem>
            </dl>
          </CardContent>
        </Card>
        <AttendanceStatsCard userId={userId} loadHistory={loadHistory} />
        <PlayerRsvpHistory
          userId={userId}
          loadHistory={loadHistory}
          matchHref={matchHref}
        />
      </div>
    </div>
  )
}

function DetailItem({
  label,
  wide = false,
  children,
}: {
  label: string
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-base text-foreground">{children}</dd>
    </div>
  )
}
