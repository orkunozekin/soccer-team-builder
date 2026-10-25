import type { UserRole } from '@/types/user'

export type AdminUserFilter = 'club_admins' | 'super_users' | 'users'

/** Super-user-only filters on `/admin/users`. */
export const ADMIN_USER_FILTERS: {
  value: AdminUserFilter
  label: string
}[] = [
  { value: 'club_admins', label: 'Club admins' },
  { value: 'super_users', label: 'Super users' },
  { value: 'users', label: 'Users' },
]

/** True when `user` belongs in the selected admin users filter. */
export function matchesAdminUserFilter(
  user: { uid: string; role: UserRole },
  filter: AdminUserFilter,
  clubAdminUids: ReadonlySet<string>
): boolean {
  if (filter === 'club_admins') return clubAdminUids.has(user.uid)
  if (filter === 'super_users') return user.role === 'super_user'
  return user.role === 'user'
}
