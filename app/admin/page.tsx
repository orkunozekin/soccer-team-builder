'use client'

import { AdminRouteGuard } from '@/components/admin/AdminRouteGuard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAdmin } from '@/lib/hooks/useAdmin'

function AdminDashboardContent() {
  const { role, isSuperAdmin } = useAdmin()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Manage matches, teams, and RSVP polls
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Match Management</CardTitle>
            <CardDescription>
              Create and manage soccer matches
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Match management will be available in Phase 3
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>RSVP Poll Controls</CardTitle>
            <CardDescription>
              Manage RSVP poll schedules
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              RSVP poll controls will be available in Phase 4
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team Management</CardTitle>
            <CardDescription>
              View and manage team assignments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Team management will be available in Phase 5
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Admin Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Role:</span> {role}
            </p>
            {isSuperAdmin && (
              <p className="text-zinc-600 dark:text-zinc-400">
                You have super admin privileges
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AdminPage() {
  return (
    <AdminRouteGuard>
      <AdminDashboardContent />
    </AdminRouteGuard>
  )
}
