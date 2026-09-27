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
import { Card, CardContent } from '@/components/ui/card'
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
import { useAuth } from '@/lib/hooks/useAuth'
import {
  getUsersCount,
  getUsersPaginated,
} from '@/lib/services/userService'
import { User, UserRole } from '@/types/user'

const PAGE_SIZE = 10

type UserRow = Pick<User, 'uid' | 'email' | 'displayName' | 'role'>

type UsersPageData = {
  users: UserRow[]
  nextCursor: string | null
}

function adminUsersPageKey(
  uid: string,
  page: number,
  cursor: string | null
) {
  return ['admin-users', uid, page, cursor] as const
}

function adminUsersCountKey(uid: string) {
  return ['admin-users-count', uid] as const
}

function isAdminUsersPageKey(
  key: unknown
): key is ReturnType<typeof adminUsersPageKey> {
  return Array.isArray(key) && key[0] === 'admin-users' && typeof key[1] === 'string'
}

export function UserRoleManager() {
  const { user: currentUser } = useAuth()
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
  // cursors[i] = cursor to request page i+1 (cursors[0] = cursor for page 2)
  const [cursors, setCursors] = useState<(string | null)[]>([null])

  const browsing = query.trim() === ''
  const adminUid = currentUser?.uid ?? null
  const cursorForPage = page === 1 ? null : (cursors[page - 2] ?? null)
  // Scope by admin uid so a later sign-in cannot reuse another session's cache
  // (revalidateIfStale: false would otherwise serve stale pages/counts).
  const pageKey =
    browsing && adminUid
      ? adminUsersPageKey(adminUid, page, cursorForPage)
      : null

  const {
    data: pageData,
    isLoading: pageLoading,
  } = useSWR(
    pageKey,
    async ([, , , cursor]: readonly [
      'admin-users',
      string,
      number,
      string | null,
    ]) => {
      const result = await getUsersPaginated(PAGE_SIZE, cursor ?? undefined)
      return {
        users: result.users.map(u => ({
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          role: u.role,
        })),
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

  const { data: totalCount = 0, mutate: mutateCount } = useSWR(
    browsing && adminUid ? adminUsersCountKey(adminUid) : null,
    () => getUsersCount(),
    { revalidateIfStale: false, revalidateOnReconnect: false }
  )

  // Remember forward cursors so page N+1 can be requested.
  useEffect(() => {
    if (!pageData) return
    setCursors(prev => {
      const next = [...prev]
      if (next[page - 1] === pageData.nextCursor) return prev
      next[page - 1] = pageData.nextCursor
      return next
    })
  }, [page, pageData])

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

  const baseUsers = searchUsers ?? pageData?.users ?? []

  const visibleUsers = useMemo(() => {
    if (!currentUser?.uid) return baseUsers
    return baseUsers.filter(u => u.uid !== currentUser.uid)
  }, [baseUsers, currentUser?.uid])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const patchUserInSwrCache = (userId: string, patch: Partial<UserRow>) => {
    setSearchUsers(prev =>
      prev
        ? prev.map(u => (u.uid === userId ? { ...u, ...patch } : u))
        : prev
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
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdating(userId)
    setError('')
    setSuccess(false)

    try {
      await updateUserRoleAPI(userId, newRole)
      patchUserInSwrCache(userId, { role: newRole })
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
      await mutateCount(prev => Math.max(0, (prev ?? 0) - 1), {
        revalidate: false,
      })
      setDeleteDialogUserId(null)

      if (visibleUsers.length <= 1 && page > 1) {
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

  if (browsing && pageLoading && !pageData) {
    return <CardLoadingSkeleton />
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
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

        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search users by name or email…"
          className="h-11 text-base sm:h-9 sm:text-sm"
        />

        <div className="max-h-96 space-y-2 overflow-y-auto md:max-h-[70vh]">
          {searchLoading || (browsing && pageLoading && visibleUsers.length === 0) ? (
            <div className="rounded-md border p-4 text-sm text-zinc-600 dark:text-zinc-400">
              {searchLoading ? 'Searching…' : 'Loading…'}
            </div>
          ) : visibleUsers.length === 0 ? (
            <div className="rounded-md border p-4 text-sm text-zinc-600 dark:text-zinc-400">
              No users found.
            </div>
          ) : (
            visibleUsers.map(user => (
              <div
                key={user.uid}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/players/${user.uid}`}
                    className="block truncate font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                  >
                    {user.displayName}
                  </Link>
                  <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                    {user.email}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Select
                    value={user.role}
                    onValueChange={(value: UserRole) =>
                      handleRoleChange(user.uid, value)
                    }
                    disabled={updating === user.uid || deleting === user.uid}
                  >
                    <SelectTrigger className="h-9 w-[8.5rem]">
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
                    className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={updating === user.uid || deleting === user.uid}
                    onClick={() => setDeleteDialogUserId(user.uid)}
                    aria-label={`Remove ${user.displayName || user.email}`}
                  >
                    <CloseIcon
                      className={deleting === user.uid ? 'opacity-50' : ''}
                    />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

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
                  if (deleteDialogUserId)
                    handleConfirmDelete(deleteDialogUserId)
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? <ButtonSpinner /> : 'Remove user'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {browsing && totalCount > PAGE_SIZE && (
          <Pagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            onPrevious={() => setPage(p => Math.max(1, p - 1))}
            onNext={() => {
              setCursors(prev => {
                const next = [...prev]
                next[page - 1] =
                  pageData?.nextCursor ?? next[page - 1] ?? null
                return next
              })
              setPage(p => p + 1)
            }}
            itemLabel="users"
          />
        )}
      </CardContent>
    </Card>
  )
}
