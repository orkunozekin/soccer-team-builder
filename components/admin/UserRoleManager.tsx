'use client'

import { useState, useEffect } from 'react'
import { User, UserRole } from '@/types/user'
import { getAllUsers, updateUser } from '@/lib/services/userService'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CardLoadingSkeleton } from '@/components/LoadingSkeleton'
import { useAuth } from '@/lib/hooks/useAuth'

export function UserRoleManager() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const allUsers = await getAllUsers()
        setUsers(allUsers)
      } catch (err) {
        console.error('Error fetching users:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [])

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
          Manage user roles. Only super admins can change roles.
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
                    <SelectItem value="superAdmin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
                {user.uid === currentUser?.uid && (
                  <span className="text-xs text-zinc-500">(You)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
