'use client'

import { useEffect, useMemo, useState } from 'react'
import { deleteUserAPI, searchUsersAPI } from '@/lib/api/client'
import { User, UserRole } from '@/types/user'
import { getUsersPaginated, getUsersCount, updateUser } from '@/lib/services/userService'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import { CardLoadingSkeleton } from '@/components/LoadingSkeleton'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import CloseIcon from '@/components/icons/CloseIcon'
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

const PAGE_SIZE = 10

type UserRow = Pick<User, 'uid' | 'email' | 'displayName' | 'role'>

export function UserRoleManager() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchUsers, setSearchUsers] = useState<UserRow[] | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteDialogUserId, setDeleteDialogUserId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  // cursors[i] = cursor to request page i+1 (cursors[0] = cursor for page 2)
  const [cursors, setCursors] = useState<(string | null)[]>([null])

  const baseUsers = searchUsers ?? users

  const visibleUsers = useMemo(() => {
    if (!currentUser?.uid) return baseUsers
    return baseUsers.filter((u) => u.uid !== currentUser.uid)
  }, [baseUsers, currentUser?.uid])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const fetchPage = async (pageNum: number, cursor: string | null) => {
    setLoading(true)
    try {
      const [pageResult, count] = await Promise.all([
        getUsersPaginated(PAGE_SIZE, cursor ?? undefined),
        pageNum === 1 ? getUsersCount() : Promise.resolve(0),
      ])
      setUsers(
        pageResult.users.map((u) => ({
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          role: u.role,
        }))
      )
      if (pageNum === 1) {
        setTotalCount(count)
      }
      setCursors((prev) => {
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
    const cursorForRequest = page === 1 ? null : cursors[page - 2] ?? null
    fetchPage(page, cursorForRequest)
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
        .then((res) => {
          if (cancelled) return
          setSearchUsers(res.users)
        })
        .catch((err: unknown) => {
          if (cancelled) return
          const message = err instanceof Error ? err.message : String(err)
          setError(message || 'Failed to search users')
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

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdating(userId)
    setError('')
    setSuccess(false)

    try {
      await updateUser(userId, { role: newRole })
      
      // Update local state
      setUsers((prevUsers) => prevUsers.map((u) => (u.uid === userId ? { ...u, role: newRole } : u)))
      setSearchUsers((prev) => (prev ? prev.map((u) => (u.uid === userId ? { ...u, role: newRole } : u)) : prev))

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

      setUsers((prev) => prev.filter((u) => u.uid !== userId))
      setSearchUsers((prev) => (prev ? prev.filter((u) => u.uid !== userId) : prev))
      setTotalCount((prev) => Math.max(0, prev - 1))
      setDeleteDialogUserId(null)

      // If we just deleted the last visible row on this page, go back a page.
      if (visibleUsers.length <= 1 && page > 1) {
        setPage((p) => Math.max(1, p - 1))
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to remove user')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return <CardLoadingSkeleton />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>
          Manage users. Change roles or remove users.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users by name or email…"
          className="h-11 text-base sm:h-9 sm:text-sm"
        />

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {searchLoading ? (
            <div className="rounded-md border p-4 text-sm text-zinc-600 dark:text-zinc-400">
              Searching…
            </div>
          ) : visibleUsers.length === 0 ? (
            <div className="rounded-md border p-4 text-sm text-zinc-600 dark:text-zinc-400">
              No users found.
            </div>
          ) : (
            visibleUsers.map((user) => (
            <div
              key={user.uid}
              className="flex items-center justify-between gap-4 p-3 border rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user.displayName}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
                  {user.email}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select
                  value={user.role}
                  onValueChange={(value: UserRole) =>
                    handleRoleChange(user.uid, value)
                  }
                  disabled={updating === user.uid || deleting === user.uid}
                >
                  <SelectTrigger className="w-24 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
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
                  <CloseIcon className={deleting === user.uid ? 'opacity-50' : ''} />
                </Button>
              </div>
            </div>
            ))
          )}
        </div>

        <AlertDialog
          open={deleteDialogUserId != null}
          onOpenChange={(open) => {
            if (!open) setDeleteDialogUserId(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove user?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete the user from the system (Auth + database) and remove them from teams/bench/RSVPs. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting != null}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteDialogUserId == null || deleting != null}
                onClick={(e) => {
                  e.preventDefault()
                  if (deleteDialogUserId) handleConfirmDelete(deleteDialogUserId)
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Removing...' : 'Remove user'}
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
            onPrevious={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
            itemLabel="users"
          />
        )}
      </CardContent>
    </Card>
  )
}
