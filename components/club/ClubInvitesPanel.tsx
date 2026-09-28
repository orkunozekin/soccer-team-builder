'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import {
  createClubInviteAPI,
  listClubInvitesAPI,
  revokeClubInviteAPI,
} from '@/lib/api/client'
import type { ClubInvite } from '@/types/club'

type InviteWithLink = ClubInvite & { link: string }

/** List responses omit Origin, so a missing app URL comes back as `/join?code=…`. */
function shareableInviteLink(link: string) {
  if (!link.startsWith('/')) return link
  if (typeof window === 'undefined') return link
  return `${window.location.origin}${link}`
}

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
  const clubIdRef = useRef(clubId)
  clubIdRef.current = clubId
  /** Bumped on each list request so older responses cannot overwrite newer ones. */
  const listGenRef = useRef(0)

  const applyInvitesIfCurrent = useCallback(
    (
      requestClubId: string,
      gen: number,
      next: InviteWithLink[] | ((prev: InviteWithLink[]) => InviteWithLink[])
    ) => {
      if (clubIdRef.current !== requestClubId || listGenRef.current !== gen) {
        return false
      }
      setInvites(next)
      return true
    },
    []
  )

  const load = useCallback(async () => {
    if (!canManageInvites) {
      setLoading(false)
      return
    }
    const requestClubId = clubId
    const gen = ++listGenRef.current
    setLoading(true)
    setError('')
    try {
      const res = await listClubInvitesAPI(requestClubId)
      applyInvitesIfCurrent(requestClubId, gen, res.invites)
    } catch (err) {
      if (clubIdRef.current !== requestClubId || listGenRef.current !== gen) {
        return
      }
      // Keep the existing list so a failed refresh does not hide revoke controls.
      setError(err instanceof Error ? err.message : 'Failed to load invites')
      throw err
    } finally {
      if (clubIdRef.current === requestClubId && listGenRef.current === gen) {
        setLoading(false)
      }
    }
  }, [clubId, canManageInvites, applyInvitesIfCurrent])

  useEffect(() => {
    let cancelled = false
    const requestClubId = clubId
    const gen = ++listGenRef.current
    setCreated(null)
    setBusy(false)
    setBusyInviteId(null)
    setInvites([])
    setError('')

    if (!canManageInvites) {
      setLoading(false)
      return
    }

    setLoading(true)
    void listClubInvitesAPI(requestClubId)
      .then(res => {
        if (cancelled) return
        applyInvitesIfCurrent(requestClubId, gen, res.invites)
      })
      .catch((err: unknown) => {
        if (
          cancelled ||
          clubIdRef.current !== requestClubId ||
          listGenRef.current !== gen
        ) {
          return
        }
        setError(err instanceof Error ? err.message : 'Failed to load invites')
      })
      .finally(() => {
        if (
          cancelled ||
          clubIdRef.current !== requestClubId ||
          listGenRef.current !== gen
        ) {
          return
        }
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [clubId, canManageInvites, applyInvitesIfCurrent])

  const handleCreate = async () => {
    const requestClubId = clubId
    setBusy(true)
    setError('')
    try {
      const res = await createClubInviteAPI(requestClubId)
      if (clubIdRef.current !== requestClubId) return
      setCreated({ code: res.invite.code, link: res.link })
      if (canManageInvites) {
        try {
          await load()
        } catch {
          if (clubIdRef.current !== requestClubId) return
          setError('Invite created, but failed to refresh the list')
        }
      }
    } catch (err) {
      if (clubIdRef.current !== requestClubId) return
      setError(err instanceof Error ? err.message : 'Failed to create invite')
    } finally {
      if (clubIdRef.current === requestClubId) {
        setBusy(false)
      }
    }
  }

  const handleRevoke = async (inviteId: string) => {
    const requestClubId = clubId
    setBusyInviteId(inviteId)
    setError('')
    try {
      await revokeClubInviteAPI(requestClubId, inviteId)
      if (clubIdRef.current !== requestClubId) return
      setInvites(prev => prev.filter(i => i.id !== inviteId))
    } catch (err) {
      if (clubIdRef.current !== requestClubId) return
      setError(err instanceof Error ? err.message : 'Failed to revoke invite')
    } finally {
      if (clubIdRef.current === requestClubId) {
        setBusyInviteId(prev => (prev === inviteId ? null : prev))
      }
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

  const actionsLocked = busy || loading

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
        <Button
          type="button"
          disabled={busy}
          onClick={() => void handleCreate()}
        >
          {busy ? 'Creating…' : 'Create invite'}
        </Button>
      </div>

      {created && (
        <div className="flex flex-col gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row">
          <div className="shrink-0 self-center rounded-md bg-white p-2 sm:self-start">
            <QRCodeSVG
              value={shareableInviteLink(created.link)}
              size={160}
              title="Invite QR code"
              role="img"
              aria-label="Invite QR code"
            />
          </div>
          <div className="min-w-0 space-y-3">
            <p className="text-zinc-600 dark:text-zinc-300">
              Scan this QR code to join the club.
            </p>
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
                {shareableInviteLink(created.link)}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  void copyText(shareableInviteLink(created.link), 'link')
                }
              >
                {copied === 'link' ? 'Copied' : 'Copy link'}
              </Button>
            </div>
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
                    className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between"
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
                        onClick={() =>
                          void copyText(
                            shareableInviteLink(invite.link),
                            `link-${invite.id}`
                          )
                        }
                      >
                        {copied === `link-${invite.id}`
                          ? 'Copied'
                          : 'Copy link'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={revokeBusy || actionsLocked}
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
