'use client'

import { useState } from 'react'
import { Settings, Ticket, Users } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { InitialsAvatar } from '@/components/ui/initials-avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusPill } from '@/components/ui/status-pill'
import { updateProfileAPI } from '@/lib/api/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useClubMemberships } from '@/lib/hooks/useClubMemberships'
import { cn } from '@/lib/utils'
import {
  clubInvitesPath,
  clubRosterPath,
  clubSettingsPath,
} from '@/lib/utils/clubPaths'
import { formatMembershipRole } from '@/lib/utils/roleLabels'
import { useAuthStore } from '@/store/authStore'

export function ProfileClubsSection() {
  const { userData } = useAuth()
  const mergeUserData = useAuthStore(state => state.mergeUserData)
  const { memberships, loading, error, refresh } = useClubMemberships()
  const [activeBusy, setActiveBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const adminClubs = memberships.filter(m => m.role === 'club_admin')
  const activeClubId = userData?.activeClubId ?? null

  const handleSetActiveClub = async (clubId: string | null) => {
    if (!userData) return
    setActiveBusy(true)
    setActionError('')
    try {
      await updateProfileAPI({ activeClubId: clubId })
      mergeUserData(userData.uid, { activeClubId: clubId })
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to set active club'
      )
    } finally {
      setActiveBusy(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading clubs…</p>
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>
  }

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="rounded-md bg-red-900/20 p-3 text-sm text-red-400">
          {actionError}
        </div>
      )}

      <section aria-labelledby="your-clubs-heading">
        <h2
          id="your-clubs-heading"
          className="text-sm font-semibold text-foreground"
        >
          Your clubs
        </h2>
        {memberships.length === 0 ? (
          <div className="mt-3 space-y-4 rounded-2xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              You are not a member of any club yet. Enter an invite code below,
              or open the{' '}
              <a href="/join" className="underline underline-offset-2">
                join page
              </a>
              .
            </p>
            <JoinClubForm onJoined={() => void refresh()} />
          </div>
        ) : (
          <ul className="mt-3 space-y-4">
            {memberships.map(m => {
              const isActive = activeClubId === m.clubId
              const isAdmin = m.role === 'club_admin'
              return (
                <li
                  key={m.id}
                  className={cn(
                    'rounded-2xl border bg-card p-4 sm:p-5',
                    isActive ? 'border-emerald-800/60' : 'border-border'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <InitialsAvatar
                      name={m.club.name}
                      className="h-11 w-11 text-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-foreground">
                        {m.club.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StatusPill tone="neutral">
                          {formatMembershipRole(m.role)}
                        </StatusPill>
                        {isActive && (
                          <StatusPill tone="success">Active</StatusPill>
                        )}
                      </div>
                    </div>
                    {!isActive && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        disabled={activeBusy}
                        onClick={() => handleSetActiveClub(m.clubId)}
                      >
                        {activeBusy ? 'Saving…' : 'Set as active'}
                      </Button>
                    )}
                  </div>

                  {isAdmin && (
                    <nav
                      aria-label={`Manage ${m.club.name}`}
                      className="mt-4 grid grid-cols-3 gap-2"
                    >
                      {[
                        {
                          label: 'Roster',
                          href: clubRosterPath(m.club.slug),
                          Icon: Users,
                        },
                        {
                          label: 'Invites',
                          href: clubInvitesPath(m.club.slug),
                          Icon: Ticket,
                        },
                        {
                          label: 'Settings',
                          href: clubSettingsPath(m.club.slug),
                          Icon: Settings,
                        },
                      ].map(({ label, href, Icon }) => (
                        <Link
                          key={label}
                          href={href}
                          className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-accent/40 px-2 py-3 text-sm font-medium text-foreground transition-colors hover:border-emerald-700/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]"
                        >
                          <Icon
                            aria-hidden
                            className="h-5 w-5 text-emerald-300 transition-transform group-hover:scale-110"
                          />
                          {label}
                        </Link>
                      ))}
                    </nav>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {memberships.length > 1 && activeClubId && (
          <p className="mt-3 text-xs text-muted-foreground">
            Match lists and new matches use your active club. You can also
            switch from the club bar.
          </p>
        )}
      </section>

      {memberships.length > 0 && adminClubs.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You are a player in your clubs. Club admins can share invite codes.
        </p>
      )}
    </div>
  )
}

/** Compact join-by-code form used on profile empty state and /join */
export function JoinClubForm({ onJoined }: { onJoined?: () => void }) {
  const { user } = useAuth()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const trimmed = code.trim()
    if (!trimmed) {
      setError('Enter an invite code')
      return
    }
    setLoading(true)
    try {
      const { redeemInviteAPI } = await import('@/lib/api/client')
      const { afterInviteRedeemed } =
        await import('@/lib/hooks/useClubMemberships')
      const res = await redeemInviteAPI(trimmed)
      if (user?.uid) {
        await afterInviteRedeemed({
          uid: user.uid,
          clubId: res.clubId,
          alreadyMember: res.alreadyMember,
        })
      }
      setSuccess(
        res.alreadyMember
          ? 'You are already a member of this club.'
          : 'Joined club successfully.'
      )
      setCode('')
      onJoined?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded-md bg-red-900/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-900/20 p-3 text-sm text-green-400">
          {success}
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="invite-code">Invite code</Label>
        <Input
          id="invite-code"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="ABCD12"
          autoCapitalize="characters"
          className="font-mono tracking-wider"
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? 'Joining…' : 'Join club'}
      </Button>
    </form>
  )
}
