'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import useSWR, { useSWRConfig } from 'swr'
import CloseIcon from '@/components/icons/CloseIcon'
import { CardLoadingSkeleton } from '@/components/LoadingSkeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ButtonSpinner } from '@/components/ui/button-spinner'
import { Card } from '@/components/ui/card'
import { InitialsAvatar } from '@/components/ui/initials-avatar'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  deleteUserAPI,
  searchUsersAPI,
  updateUserRoleAPI,
} from '@/lib/api/client'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  LIST_PAGE_SIZE,
  useClientPagination,
} from '@/lib/hooks/useClientPagination'
import {
  getClubAdminUserIds,
  getUsersCount,
  getUsersForAdminFilter,
  getUsersPaginated,
} from '@/lib/services/userService'
import { cn } from '@/lib/utils'
import {
  ADMIN_USER_FILTERS,
  type AdminUserFilter,
  matchesAdminUserFilter,
} from '@/lib/utils/adminUserFilters'
import { User, UserRole } from '@/types/user'

const PAGE_SIZE = LIST_PAGE_SIZE

type UserRow = Pick<User, 'uid' | 'email' | 'displayName' | 'role'>

type UsersPageData = {
  users: UserRow[]
  nextCursor: string | null
}

function toUserRow(u: User): UserRow {
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
  }
}

function adminUsersPageKey(uid: string, page: number, cursor: string | null) {
  return ['admin-users', uid, page, cursor] as const
}

function adminUsersCountKey(uid: string) {
  return ['admin-users-count', uid] as const
}

function adminUsersFilterKey(uid: string, filter: AdminUserFilter) {
  return ['admin-users-filter', uid, filter] as const
}

function isAdminUsersPageKey(
  key: unknown
): key is ReturnType<typeof adminUsersPageKey> {
  return (
    Array.isArray(key) && key[0] === 'admin-users' && typeof key[1] === 'string'
  )
}

function isAdminUsersFilterKey(
  key: unknown
): key is ReturnType<typeof adminUsersFilterKey> {
  return (
    Array.isArray(key) &&
    key[0] === 'admin-users-filter' &&
    typeof key[1] === 'string'
  )
}

export function UserRoleManager() {
  const { user: currentUser } = useAuth()
  const { isSuperUser } = useAdmin()
  const { mutate: globalMutate } = useSWRConfig()
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchUsers, setSearchUsers] = useState<UserRow[] | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteDialogUserId, setDeleteDialogUserId] = useState<string | null>(
    null
  )
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<AdminUserFilter>('users')
  // cursors[i] = cursor to request page i+1 (cursors[0] = cursor for page 2)
  const [cursors, setCursors] = useState<(string | null)[]>([null])

  const browsing = query.trim() === ''
  const adminUid = currentUser?.uid ?? null
  const showRoleFilter = Boolean(isSuperUser)
  const useFilteredFetch = showRoleFilter
  const cursorForPage = page === 1 ? null : (cursors[page - 2] ?? null)

  // Scope by admin uid so a later sign-in cannot reuse another session's cache
  // (revalidateIfStale: false would otherwise serve stale pages/counts).
  const pageKey =
    browsing && adminUid && !useFilteredFetch
      ? adminUsersPageKey(adminUid, page, cursorForPage)
      : null

  const filterKey =
    browsing && adminUid && useFilteredFetch
      ? adminUsersFilterKey(adminUid, roleFilter)
      : null

  const { data: pageData, isLoading: pageLoading } = useSWR(
    pageKey,
    async ([, , , cursor]: readonly [
      'admin-users',
      string,
      number,
      string | null,
    ]) => {
      const result = await getUsersPaginated(PAGE_SIZE, cursor ?? undefined)
      return {
        users: result.users.map(toUserRow),
        nextCursor: result.nextCursor,
      } satisfies UsersPageData
    },
    {
      // Keep paged results until an explicit mutate (role/delete), so paging
      // back does not refetch.
      revalidateIfStale: false,
      revalidateOnReconnect: false,
    }
  )

  const {
    data: filteredUsers = [],
    isLoading: filterLoading,
    mutate: mutateFiltered,
  } = useSWR(
    filterKey,
    async ([, , filter]: readonly [
      'admin-users-filter',
      string,
      AdminUserFilter,
    ]) => {
      const users = await getUsersForAdminFilter(filter)
      return users.map(toUserRow)
    },
    {
      revalidateIfStale: false,
      revalidateOnReconnect: false,
    }
  )

  const { data: totalCount = 0, mutate: mutateCount } = useSWR(
    browsing && adminUid && !useFilteredFetch
      ? adminUsersCountKey(adminUid)
      : null,
    () => getUsersCount(),
    { revalidateIfStale: false, revalidateOnReconnect: false }
  )

  const { data: clubAdminIds = [] } = useSWR(
    showRoleFilter && roleFilter === 'club_admins' && adminUid
      ? (['admin-club-admin-ids', adminUid] as const)
      : null,
    () => getClubAdminUserIds(),
    { revalidateIfStale: false, revalidateOnReconnect: false }
  )

  const clubAdminUidSet = useMemo(
    () => new Set(clubAdminIds),
    [clubAdminIds]
  )

  // Remember forward cursors so page N+1 can be requested.
  useEffect(() => {
    if (!pageData || useFilteredFetch) return
    setCursors(prev => {
      const next = [...prev]
      if (next[page - 1] === pageData.nextCursor) return prev
      next[page - 1] = pageData.nextCursor
      return next
    })
  }, [page, pageData, useFilteredFetch])

  // Backend search (debounced) so we search the entire DB.
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setSearchUsers(null)
      setSearchLoading(false)
      return
    }

    let cancelled = false
    setSearchLoading(true)

    const t = setTimeout(() => {
      searchUsersAPI(q, 25)
        .then(res => {
          if (cancelled) return
          setSearchUsers(res.users)
        })
        .catch(() => {
          if (cancelled) return
          setError('Failed to search users')
          setSearchUsers([])
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false)
        })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  const baseUsers = useMemo(() => {
    if (searchUsers) {
      if (!showRoleFilter) return searchUsers
      return searchUsers.filter(u =>
        matchesAdminUserFilter(u, roleFilter, clubAdminUidSet)
      )
    }
    if (useFilteredFetch) return filteredUsers
    return pageData?.users ?? []
  }, [
    searchUsers,
    showRoleFilter,
    useFilteredFetch,
    roleFilter,
    clubAdminUidSet,
    filteredUsers,
    pageData?.users,
  ])

  const withoutSelf = useMemo(() => {
    if (!currentUser?.uid) return baseUsers
    return baseUsers.filter(u => u.uid !== currentUser.uid)
  }, [baseUsers, currentUser?.uid])

  const filteredScope = useFilteredFetch
    ? `${adminUid ?? ''}:${roleFilter}:${query.trim()}`
    : ''
  const pagedFiltered = useClientPagination(
    useFilteredFetch && browsing ? withoutSelf : [],
    filteredScope
  )

  const visibleUsers =
    useFilteredFetch && browsing ? pagedFiltered.items : withoutSelf

  const unfilteredTotalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const showPagination = browsing
    ? useFilteredFetch
      ? pagedFiltered.pagination.totalCount > PAGE_SIZE
      : totalCount > PAGE_SIZE
    : false

  const patchUserInSwrCache = (userId: string, patch: Partial<UserRow>) => {
    setSearchUsers(prev =>
      prev ? prev.map(u => (u.uid === userId ? { ...u, ...patch } : u)) : prev
    )
    void globalMutate(
      (key: unknown) =>
        isAdminUsersPageKey(key) && (!adminUid || key[1] === adminUid),
      (current: UsersPageData | undefined) => {
        if (!current) return current
        return {
          ...current,
          users: current.users.map(u =>
            u.uid === userId ? { ...u, ...patch } : u
          ),
        }
      },
      { revalidate: false }
    )
    void globalMutate(
      (key: unknown) =>
        isAdminUsersFilterKey(key) && (!adminUid || key[1] === adminUid),
      (current: UserRow[] | undefined) => {
        if (!current) return current
        return current.map(u => (u.uid === userId ? { ...u, ...patch } : u))
      },
      { revalidate: false }
    )
  }

  const removeUserFromSwrCache = (userId: string) => {
    setSearchUsers(prev => (prev ? prev.filter(u => u.uid !== userId) : prev))
    void globalMutate(
      (key: unknown) =>
        isAdminUsersPageKey(key) && (!adminUid || key[1] === adminUid),
      (current: UsersPageData | undefined) => {
        if (!current) return current
        return {
          ...current,
          users: current.users.filter(u => u.uid !== userId),
        }
      },
      { revalidate: false }
    )
    // Drop later page keys — cursors after a delete are stale.
    void globalMutate(
      (key: unknown) =>
        isAdminUsersPageKey(key) &&
        (!adminUid || key[1] === adminUid) &&
        typeof key[2] === 'number' &&
        key[2] > page,
      undefined,
      { revalidate: false }
    )
    setCursors(prev => prev.slice(0, page))
    void mutateFiltered(
      prev => (prev ? prev.filter(u => u.uid !== userId) : prev),
      { revalidate: false }
    )
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdating(userId)
    setError('')
    setSuccess(false)

    try {
      await updateUserRoleAPI(userId, newRole)
      patchUserInSwrCache(userId, { role: newRole })
      // Role may move the row out of the active filter; refresh that list.
      if (useFilteredFetch) {
        await mutateFiltered()
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update user role')
    } finally {
      setUpdating(null)
    }
  }

  const handleConfirmDelete = async (userId: string) => {
    setDeleting(userId)
    setError('')
    setSuccess(false)

    try {
      await deleteUserAPI(userId)

      removeUserFromSwrCache(userId)
      if (!useFilteredFetch) {
        await mutateCount(prev => Math.max(0, (prev ?? 0) - 1), {
          revalidate: false,
        })
      }
      setDeleteDialogUserId(null)

      if (visibleUsers.length <= 1 && page > 1 && !useFilteredFetch) {
        setPage(p => Math.max(1, p - 1))
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Failed to remove user')
    } finally {
      setDeleting(null)
    }
  }

  const listLoading = useFilteredFetch
    ? browsing && filterLoading && filteredUsers.length === 0
    : browsing && pageLoading && !pageData

  if (listLoading) {
    return <CardLoadingSkeleton />
  }

  const pagination = useFilteredFetch
    ? pagedFiltered.pagination
    : {
        page,
        totalPages: unfilteredTotalPages,
        totalCount,
        pageSize: PAGE_SIZE,
        onPrevious: () => setPage(p => Math.max(1, p - 1)),
        onNext: () => {
          setCursors(prev => {
            const next = [...prev]
            next[page - 1] = pageData?.nextCursor ?? next[page - 1] ?? null
            return next
          })
          setPage(p => p + 1)
        },
      }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
          Changes saved successfully!
        </div>
      )}

      {showRoleFilter ? (
        <div
          role="tablist"
          aria-label="Filter users"
          className="flex flex-wrap gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900/50"
        >
          {ADMIN_USER_FILTERS.map(option => {
            const active = roleFilter === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRoleFilter(option.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                  active
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      ) : null}

      <Input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search users by name or email…"
        className="h-11 text-base sm:h-9 sm:text-sm"
      />

      {searchLoading ||
      (browsing &&
        (useFilteredFetch ? filterLoading : pageLoading) &&
        visibleUsers.length === 0) ? (
        <Card className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {searchLoading ? 'Searching…' : 'Loading…'}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {visibleUsers.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No users found.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {visibleUsers.map(user => (
                <li
                  key={user.uid}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                >
                  <InitialsAvatar name={user.displayName || user.email} />
                  <div className="min-w-[8rem] flex-1">
                    <Link
                      href={`/admin/players/${user.uid}`}
                      className="block truncate text-sm font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                    >
                      {user.displayName}
                    </Link>
                    <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {user.email}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Select
                      value={user.role}
                      onValueChange={(value: UserRole) =>
                        handleRoleChange(user.uid, value)
                      }
                      disabled={updating === user.uid || deleting === user.uid}
                    >
                      <SelectTrigger className="h-9 w-[8.5rem] shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="super_user">Super user</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={updating === user.uid || deleting === user.uid}
                      onClick={() => setDeleteDialogUserId(user.uid)}
                      aria-label={`Remove ${user.displayName || user.email}`}
                    >
                      <CloseIcon
                        className={deleting === user.uid ? 'opacity-50' : ''}
                      />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {showPagination && (
            <Pagination
              className="mt-0 border-zinc-100 px-4 py-3 dark:border-zinc-800"
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalCount={pagination.totalCount}
              pageSize={pagination.pageSize}
              onPrevious={pagination.onPrevious}
              onNext={pagination.onNext}
              itemLabel="users"
            />
          )}
        </Card>
      )}

      <AlertDialog
        open={deleteDialogUserId != null}
        onOpenChange={open => {
          if (!open) setDeleteDialogUserId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the user from the system (Auth + database) and
              remove them from teams/RSVPs. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting != null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteDialogUserId == null || deleting != null}
              onClick={e => {
                e.preventDefault()
                if (deleteDialogUserId) handleConfirmDelete(deleteDialogUserId)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <ButtonSpinner /> : 'Remove user'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
