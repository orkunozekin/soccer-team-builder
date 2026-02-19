'use client'

import { useState, useEffect } from 'react'
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

const PAGE_SIZE = 10

export function UserRoleManager() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [page, setPage] = useState(1)
  // cursors[i] = cursor to request page i+1 (cursors[0] = cursor for page 2)
  const [cursors, setCursors] = useState<(string | null)[]>([null])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const fetchPage = async (pageNum: number, cursor: string | null) => {
    setLoading(true)
    try {
      const [pageResult, count] = await Promise.all([
        getUsersPaginated(PAGE_SIZE, cursor ?? undefined),
        pageNum === 1 ? getUsersCount() : Promise.resolve(0),
      ])
      setUsers(pageResult.users)
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

  // Load page when page number changes. Page 1 uses cursor null; page N uses cursors[N-2].
  useEffect(() => {
    const cursorForRequest = page === 1 ? null : cursors[page - 2] ?? null
    fetchPage(page, cursorForRequest)
  }, [page])

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdating(userId)
    setError('')
    setSuccess(false)

    try {
      await updateUser(userId, { role: newRole })
      
      // Update local state
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.uid === userId ? { ...u, role: newRole } : u))
      )

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update user role')
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return <CardLoadingSkeleton />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Role Management</CardTitle>
        <CardDescription>
          Manage user roles.
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
            Role updated successfully!
          </div>
        )}

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {users.map((user) => (
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
              <div className="flex items-center gap-2">
                <Select
                  value={user.role}
                  onValueChange={(value: UserRole) =>
                    handleRoleChange(user.uid, value)
                  }
                  disabled={updating === user.uid || user.uid === currentUser?.uid}
                >
                  <SelectTrigger className="w-32 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                {user.uid === currentUser?.uid && (
                  <span className="text-xs text-zinc-500">(You)</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {totalCount > PAGE_SIZE && (
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
