'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
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

export function UserRoleManager() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [pageCache, setPageCache] = useState<Record<number, UserRow[]>>({})
  const [totalCount, setTotalCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
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
  const pageCacheRef = useRef(pageCache)
  pageCacheRef.current = pageCache
  const totalCountRef = useRef(totalCount)
  totalCountRef.current = totalCount

  const baseUsers = searchUsers ?? users

  const visibleUsers = useMemo(() => {
    if (!currentUser?.uid) return baseUsers
    return baseUsers.filter(u => u.uid !== currentUser.uid)
  }, [baseUsers, currentUser?.uid])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const applyPageUsers = (pageNum: number, rows: UserRow[]) => {
    setUsers(rows)
    setPageCache(prev => ({ ...prev, [pageNum]: rows }))
  }

  const fetchPage = async (
    pageNum: number,
    cursor: string | null,
    options?: { force?: boolean }
  ) => {
    const cached = pageCacheRef.current[pageNum]
    if (!options?.force && cached) {
      setUsers(cached)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const needCount = pageNum === 1 && totalCountRef.current === 0
      const [pageResult, count] = await Promise.all([
        getUsersPaginated(PAGE_SIZE, cursor ?? undefined),
        needCount ? getUsersCount() : Promise.resolve(totalCountRef.current),
      ])
      const rows = pageResult.users.map(u => ({
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
      }))
      applyPageUsers(pageNum, rows)
      if (needCount) {
        setTotalCount(count)
      }
      setCursors(prev => {
        const next = [...prev]
        next[pageNum - 1] = pageResult.nextCursor
        return next
      })
    } catch (err) {
      console.error('Error fetching users:', err)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  // Load page when page number changes (only when not searching).
  useEffect(() => {
    if (query.trim() !== '') return
    const cursorForRequest = page === 1 ? null : (cursors[page - 2] ?? null)
    void fetchPage(page, cursorForRequest)
    // Cache hits handled inside fetchPage; omit pageCache/cursors from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query])

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

  const patchUserInCaches = (userId: string, patch: Partial<UserRow>) => {
    setUsers(prev =>
      prev.map(u => (u.uid === userId ? { ...u, ...patch } : u))
    )
    setSearchUsers(prev =>
      prev
        ? prev.map(u => (u.uid === userId ? { ...u, ...patch } : u))
        : prev
    )
    setPageCache(prev => {
      const next: Record<number, UserRow[]> = {}
      for (const [key, rows] of Object.entries(prev)) {
        next[Number(key)] = rows.map(u =>
          u.uid === userId ? { ...u, ...patch } : u
        )
      }
      return next
    })
  }

  const removeUserFromCaches = (userId: string) => {
    setUsers(prev => prev.filter(u => u.uid !== userId))
    setSearchUsers(prev => (prev ? prev.filter(u => u.uid !== userId) : prev))
    // Drop later pages — cursors after a delete are stale.
    setPageCache(prev => {
      const next: Record<number, UserRow[]> = {}
      for (const [key, rows] of Object.entries(prev)) {
        const pageNum = Number(key)
        if (pageNum > page) continue
        next[pageNum] = rows.filter(u => u.uid !== userId)
      }
      return next
    })
    setCursors(prev => prev.slice(0, page))
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdating(userId)
    setError('')
    setSuccess(false)

    try {
      await updateUserRoleAPI(userId, newRole)
      patchUserInCaches(userId, { role: newRole })
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

      removeUserFromCaches(userId)
      setTotalCount(prev => Math.max(0, prev - 1))
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

  if (loading && users.length === 0 && !pageCache[page]) {
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

        <div className="max-h-96 space-y-2 overflow-y-auto">
          {searchLoading || (loading && visibleUsers.length === 0) ? (
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

        {query.trim() === '' && totalCount > PAGE_SIZE && (
          <Pagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
            onPrevious={() => setPage(p => Math.max(1, p - 1))}
            onNext={() => setPage(p => p + 1)}
            itemLabel="users"
          />
        )}
      </CardContent>
    </Card>
  )
}
