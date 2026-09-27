'use client'

import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { InitialsAvatar } from '@/components/ui/initials-avatar'
import { Pagination } from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { listClubMembersAPI, updateClubMemberRoleAPI } from '@/lib/api/client'
import type { ClubMembershipRole, ClubMembershipWithUser } from '@/types/club'

const PAGE_SIZE = 10

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
  const [page, setPage] = useState(1)
  const clubIdRef = useRef(clubId)
  clubIdRef.current = clubId

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setMembers([])
    setBusyUserId(null)
    setPage(1)

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

  const handleRoleChange = async (userId: string, role: ClubMembershipRole) => {
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
        setBusyUserId(prev => (prev === userId ? null : prev))
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(members.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageMembers = members.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  const header = (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Roster
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Promote or demote members. The last club admin cannot be demoted.
        </p>
      </div>
      {!loading && members.length > 0 && (
        <Badge variant="secondary" className="shrink-0 font-medium">
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </Badge>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-4">
        {header}
        <Card aria-busy="true" aria-label="Loading roster">
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
                <Skeleton className="h-9 w-[8.5rem]" />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {header}

      {members.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No members yet.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {pageMembers.map(member => {
              const isSelf = member.userId === currentUserId
              const isLastAdmin =
                member.role === 'club_admin' && adminCount <= 1
              const busy = busyUserId === member.userId
              const cannotDemoteSelf = isSelf && member.role === 'club_admin'
              return (
                <li
                  key={member.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                >
                  <InitialsAvatar name={member.displayName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {member.displayName}
                      </span>
                      {isSelf && (
                        <Badge
                          variant="outline"
                          className="shrink-0 px-1.5 py-0 text-[10px] font-medium text-zinc-500 dark:text-zinc-400"
                        >
                          You
                        </Badge>
                      )}
                    </div>
                    {member.email && (
                      <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
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
          {totalPages > 1 && (
            <Pagination
              className="mt-0 border-zinc-100 px-4 py-3 dark:border-zinc-800"
              page={currentPage}
              totalPages={totalPages}
              totalCount={members.length}
              pageSize={PAGE_SIZE}
              itemLabel="members"
              onPrevious={() => setPage(Math.max(1, currentPage - 1))}
              onNext={() => setPage(Math.min(totalPages, currentPage + 1))}
              onPageChange={setPage}
            />
          )}
        </Card>
      )}
    </div>
  )
}
