'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateProfileAPI } from '@/lib/api/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useClubMemberships } from '@/lib/hooks/useClubMemberships'
import {
  clubInvitesPath,
  clubRosterPath,
  clubSettingsPath,
} from '@/lib/utils/clubPaths'
import { formatMembershipRole } from '@/lib/utils/roleLabels'
import { useAuthStore } from '@/store/authStore'

export function ProfileClubsSection() {
  const { userData } = useAuth()
  const setUserData = useAuthStore(state => state.setUserData)
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
      setUserData({ ...userData, activeClubId: clubId })
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to set active club'
      )
    } finally {
      setActiveBusy(false)
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading clubs…</p>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
    )
  }

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {actionError}
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Clubs I&apos;m in
        </h3>
        {memberships.length === 0 ? (
          <div className="mt-2 space-y-3">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
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
          <ul className="mt-2 space-y-2">
            {memberships.map(m => {
              const isActive = activeClubId === m.clubId
              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                      {m.club.name}
                    </span>
                    <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {formatMembershipRole(m.role)}
                    </span>
                    {isActive && (
                      <span className="shrink-0 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        active
                      </span>
                    )}
                  </div>
                  {!isActive && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={activeBusy}
                      onClick={() => handleSetActiveClub(m.clubId)}
                    >
                      {activeBusy ? 'Saving…' : 'Set as active'}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {memberships.length > 1 && activeClubId && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Match lists and new matches use your active club. You can also
            switch from the club bar.
          </p>
        )}
      </div>

      {adminClubs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Clubs I manage
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Roster, invites, and settings live on the club bar for each club.
          </p>
          <ul className="mt-2 space-y-2">
            {adminClubs.map(m => (
              <li
                key={`admin-${m.id}`}
                className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  {m.club.name}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  <Link
                    href={clubRosterPath(m.club.slug)}
                    className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
                  >
                    Roster
                  </Link>
                  <Link
                    href={clubInvitesPath(m.club.slug)}
                    className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
                  >
                    Invites
                  </Link>
                  <Link
                    href={clubSettingsPath(m.club.slug)}
                    className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
                  >
                    Settings
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {memberships.length > 0 && adminClubs.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
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
      const { afterInviteRedeemed } = await import(
        '@/lib/hooks/useClubMemberships'
      )
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
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
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
