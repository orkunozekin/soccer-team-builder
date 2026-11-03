'use client'

import { ClubAdminPanel } from '@/components/admin/ClubAdminPanel'
import { UserRoleManager } from '@/components/admin/UserRoleManager'
import { PageHeader } from '@/components/layout/PageHeader'

export default function AdminUsersPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        eyebrow="Super user"
        title="Users"
        description="View profiles, change roles, or remove users"
      />

      <UserRoleManager />

      <div className="mt-8">
        <ClubAdminPanel />
      </div>
    </div>
  )
}
