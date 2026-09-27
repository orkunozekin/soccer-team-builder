'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  createClubInviteAPI,
  listClubInvitesAPI,
  revokeClubInviteAPI,
} from '@/lib/api/client'
import type { ClubInvite } from '@/types/club'

type InviteWithLink = ClubInvite & { link: string }

export function ClubInvitesPanel({
  clubId,
  /** Club admins can list and revoke; players with invite permission only create. */
  canManageInvites,
}: {
  clubId: string
  canManageInvites: boolean
}) {
  const [invites, setInvites] = useState<InviteWithLink[]>([])
  const [loading, setLoading] = useState(canManageInvites)
  const [busy, setBusy] = useState(false)
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{
    code: string
    link: string
  } | null>(null)
  const [copied, setCopied] = useState<'code' | 'link' | string | null>(null)

  const load = useCallback(async () => {
    if (!canManageInvites) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await listClubInvitesAPI(clubId)
      setInvites(res.invites)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invites')
      setInvites([])
    } finally {
      setLoading(false)
    }
  }, [clubId, canManageInvites])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await createClubInviteAPI(clubId)
      setCreated({ code: res.invite.code, link: res.link })
      if (canManageInvites) {
        await load()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite')
    } finally {
      setBusy(false)
    }
  }

  const handleRevoke = async (inviteId: string) => {
    setBusyInviteId(inviteId)
    setError('')
    try {
      await revokeClubInviteAPI(clubId, inviteId)
      setInvites(prev => prev.filter(i => i.id !== inviteId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invite')
    } finally {
      setBusyInviteId(null)
    }
  }

  const copyText = async (value: string, kind: 'code' | 'link' | string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setError('Could not copy to clipboard')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Invites
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Create a code or link so players can join this club.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <Button type="button" disabled={busy} onClick={() => void handleCreate()}>
          {busy ? 'Creating…' : 'Create invite'}
        </Button>
      </div>

      {created && (
        <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Code:</span>
            <code className="rounded bg-white px-2 py-0.5 font-mono tracking-wider dark:bg-zinc-800">
              {created.code}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void copyText(created.code, 'code')}
            >
              {copied === 'code' ? 'Copied' : 'Copy code'}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Link:</span>
            <code className="max-w-full truncate rounded bg-white px-2 py-0.5 dark:bg-zinc-800">
              {created.link}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void copyText(created.link, 'link')}
            >
              {copied === 'link' ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </div>
      )}

      {canManageInvites && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Active invites
          </h3>
          {loading ? (
            <p className="mt-2 text-sm text-zinc-500">Loading invites…</p>
          ) : invites.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">
              No active invites. Create one above.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {invites.map(invite => {
                const revokeBusy = busyInviteId === invite.id
                return (
                  <li
                    key={invite.id}
                    className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="min-w-0 text-sm">
                      <code className="font-mono tracking-wider">
                        {invite.code}
                      </code>
                      <div className="text-xs text-zinc-500">
                        Uses: {invite.useCount}
                        {invite.maxUses != null ? ` / ${invite.maxUses}` : ''}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void copyText(invite.code, `code-${invite.id}`)
                        }
                      >
                        {copied === `code-${invite.id}`
                          ? 'Copied'
                          : 'Copy code'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={revokeBusy}
                        onClick={() => void handleRevoke(invite.id)}
                      >
                        {revokeBusy ? '…' : 'Revoke'}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
