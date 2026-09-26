'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  listClubInvitesAPI,
  listClubMembersAPI,
  revokeClubInviteAPI,
  updateClubMemberRoleAPI,
} from '@/lib/api/client'
import type { ClubInvite, ClubMembershipWithUser } from '@/types/club'

type InviteWithLink = ClubInvite & { link: string }

export function ClubAdminRoster({
  clubId,
  currentUserId,
  /** Bump when parent creates an invite so the active list refreshes */
  refreshToken = '',
}: {
  clubId: string
  currentUserId: string
  refreshToken?: string
}) {
  const [members, setMembers] = useState<ClubMembershipWithUser[]>([])
  const [invites, setInvites] = useState<InviteWithLink[]>([])
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [membersRes, invitesRes] = await Promise.all([
        listClubMembersAPI(clubId),
        listClubInvitesAPI(clubId),
      ])
      setMembers(membersRes.members)
      setInvites(invitesRes.invites)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roster')
      setMembers([])
      setInvites([])
    } finally {
      setLoading(false)
    }
  }, [clubId])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  const adminCount = members.filter(m => m.role === 'club_admin').length

  const handleRoleChange = async (
    userId: string,
    role: 'player' | 'club_admin'
  ) => {
    setBusyKey(`role-${userId}`)
    setError('')
    try {
      await updateClubMemberRoleAPI(clubId, userId, role)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setBusyKey(null)
    }
  }

  const handleRevoke = async (inviteId: string) => {
    setBusyKey(`invite-${inviteId}`)
    setError('')
    try {
      await revokeClubInviteAPI(clubId, inviteId)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invite')
    } finally {
      setBusyKey(null)
    }
  }

  const copyText = async (inviteId: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedInviteId(inviteId)
      setTimeout(() => setCopiedInviteId(null), 2000)
    } catch {
      setError('Could not copy to clipboard')
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Loading roster…
      </p>
    )
  }

  return (
    <div className="space-y-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Roster
        </h4>
        {members.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No members yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {members.map(member => {
              const isSelf = member.userId === currentUserId
              const isLastAdmin =
                member.role === 'club_admin' && adminCount <= 1
              const busy = busyKey === `role-${member.userId}`
              return (
                <li
                  key={member.id}
                  className="flex flex-col gap-2 rounded-md bg-zinc-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between dark:bg-zinc-900"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {member.displayName}
                      {isSelf ? ' (you)' : ''}
                    </div>
                    {member.email && (
                      <div className="truncate text-xs text-zinc-500">
                        {member.email}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-md bg-zinc-200 px-2 py-0.5 text-xs font-medium capitalize text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {member.role === 'club_admin' ? 'club admin' : 'player'}
                    </span>
                    {member.role === 'player' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          handleRoleChange(member.userId, 'club_admin')
                        }
                      >
                        {busy ? '…' : 'Promote'}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy || isLastAdmin}
                        title={
                          isLastAdmin
                            ? 'Cannot demote the last club admin'
                            : undefined
                        }
                        onClick={() =>
                          handleRoleChange(member.userId, 'player')
                        }
                      >
                        {busy ? '…' : 'Demote'}
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Active invites
        </h4>
        {invites.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            No active invites. Create one above.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {invites.map(invite => {
              const busy = busyKey === `invite-${invite.id}`
              return (
                <li
                  key={invite.id}
                  className="flex flex-col gap-2 rounded-md bg-zinc-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between dark:bg-zinc-900"
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
                      onClick={() => copyText(invite.id, invite.code)}
                    >
                      {copiedInviteId === invite.id ? 'Copied' : 'Copy code'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => handleRevoke(invite.id)}
                    >
                      {busy ? '…' : 'Revoke'}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
