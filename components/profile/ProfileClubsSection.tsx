'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createClubInviteAPI,
  updateClubAPI,
} from '@/lib/api/client'
import { useClubMemberships } from '@/lib/hooks/useClubMemberships'

export function ProfileClubsSection() {
  const { memberships, loading, error, refresh } = useClubMemberships()
  const [busyClubId, setBusyClubId] = useState<string | null>(null)
  const [inviteInfo, setInviteInfo] = useState<{
    clubId: string
    code: string
    link: string
  } | null>(null)
  const [actionError, setActionError] = useState('')
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  const adminClubs = memberships.filter(m => m.role === 'club_admin')

  const handleCreateInvite = async (clubId: string) => {
    setBusyClubId(clubId)
    setActionError('')
    try {
      const res = await createClubInviteAPI(clubId)
      setInviteInfo({ clubId, code: res.invite.code, link: res.link })
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to create invite'
      )
    } finally {
      setBusyClubId(null)
    }
  }

  const handleTogglePlayerInvites = async (
    clubId: string,
    next: boolean
  ) => {
    setBusyClubId(clubId)
    setActionError('')
    try {
      await updateClubAPI(clubId, {
        settings: { allowPlayerInvites: next },
      })
      await refresh()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to update settings'
      )
    } finally {
      setBusyClubId(null)
    }
  }

  const copyText = async (value: string, kind: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setActionError('Could not copy to clipboard')
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
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            You are not a member of any club yet. Ask for an invite link or enter
            a code on the{' '}
            <a href="/join" className="underline underline-offset-2">
              join page
            </a>
            .
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {memberships.map(m => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                  {m.club.name}
                </span>
                <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium capitalize text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {m.role === 'club_admin' ? 'club admin' : 'player'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {adminClubs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Clubs I admin
          </h3>
          <ul className="mt-2 space-y-4">
            {adminClubs.map(m => (
              <li
                key={`admin-${m.id}`}
                className="space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  {m.club.name}
                </div>
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={m.club.settings.allowPlayerInvites}
                    disabled={busyClubId === m.clubId}
                    onChange={e =>
                      handleTogglePlayerInvites(m.clubId, e.target.checked)
                    }
                  />
                  Players can invite
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={busyClubId === m.clubId}
                  onClick={() => handleCreateInvite(m.clubId)}
                >
                  {busyClubId === m.clubId ? 'Working…' : 'Create invite'}
                </Button>
                {inviteInfo?.clubId === m.clubId && (
                  <div className="space-y-2 rounded-md bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">Code:</span>
                      <code className="rounded bg-white px-2 py-0.5 dark:bg-zinc-800">
                        {inviteInfo.code}
                      </code>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => copyText(inviteInfo.code, 'code')}
                      >
                        {copied === 'code' ? 'Copied' : 'Copy code'}
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">Link:</span>
                      <code className="max-w-full truncate rounded bg-white px-2 py-0.5 dark:bg-zinc-800">
                        {inviteInfo.link}
                      </code>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => copyText(inviteInfo.link, 'link')}
                      >
                        {copied === 'link' ? 'Copied' : 'Copy link'}
                      </Button>
                    </div>
                  </div>
                )}
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
      const res = await redeemInviteAPI(trimmed)
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
