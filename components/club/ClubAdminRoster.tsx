'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  listClubMembersAPI,
  updateClubMemberRoleAPI,
} from '@/lib/api/client'
import type {
  ClubMembershipRole,
  ClubMembershipWithUser,
} from '@/types/club'

export function ClubAdminRoster({
  clubId,
  currentUserId,
}: {
  clubId: string
  currentUserId: string
}) {
  const [members, setMembers] = useState<ClubMembershipWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const clubIdRef = useRef(clubId)
  clubIdRef.current = clubId

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setMembers([])
    setBusyUserId(null)

    void listClubMembersAPI(clubId)
      .then(membersRes => {
        if (cancelled || clubIdRef.current !== clubId) return
        setMembers(membersRes.members)
      })
      .catch((err: unknown) => {
        if (cancelled || clubIdRef.current !== clubId) return
        setError(err instanceof Error ? err.message : 'Failed to load roster')
        setMembers([])
      })
      .finally(() => {
        if (cancelled || clubIdRef.current !== clubId) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [clubId])

  const adminCount = members.filter(m => m.role === 'club_admin').length

  const handleRoleChange = async (
    userId: string,
    role: ClubMembershipRole
  ) => {
    const targetClubId = clubId
    setBusyUserId(userId)
    setError('')
    try {
      await updateClubMemberRoleAPI(targetClubId, userId, role)
      if (clubIdRef.current !== targetClubId) return
      setMembers(prev =>
        prev
          .map(m => (m.userId === userId ? { ...m, role } : m))
          .sort((a, b) => {
            if (a.role !== b.role) {
              return a.role === 'club_admin' ? -1 : 1
            }
            return a.displayName.localeCompare(b.displayName)
          })
      )
    } catch (err) {
      if (clubIdRef.current !== targetClubId) return
      setError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      if (clubIdRef.current === targetClubId) {
        setBusyUserId(null)
      }
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
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Roster
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Promote or demote members. The last club admin cannot be demoted.
        </p>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-zinc-500">No members yet.</p>
      ) : (
        <ul className="space-y-2">
          {members.map(member => {
            const isSelf = member.userId === currentUserId
            const isLastAdmin =
              member.role === 'club_admin' && adminCount <= 1
            const busy = busyUserId === member.userId
            const cannotDemoteSelf =
              isSelf && member.role === 'club_admin'
            return (
              <li
                key={member.id}
                className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900"
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
                <Select
                  value={member.role}
                  onValueChange={(value: ClubMembershipRole) => {
                    if (value === member.role) return
                    void handleRoleChange(member.userId, value)
                  }}
                  disabled={busy || cannotDemoteSelf}
                >
                  <SelectTrigger
                    className="h-9 w-[8.5rem] shrink-0"
                    aria-label={`Role for ${member.displayName}`}
                    title={
                      cannotDemoteSelf
                        ? 'You cannot demote yourself'
                        : isLastAdmin
                          ? 'Cannot demote the last club admin'
                          : undefined
                    }
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="player"
                      disabled={isLastAdmin || cannotDemoteSelf}
                    >
                      Player
                    </SelectItem>
                    <SelectItem value="club_admin">Club admin</SelectItem>
                  </SelectContent>
                </Select>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
