export type AdminNavLink = {
  href: string
  label: string
  isActive: (pathname: string) => boolean
}

/** Platform admin destinations. Shared by the admin page tabs and the shell. */
export const ADMIN_NAV_LINKS: AdminNavLink[] = [
  {
    href: '/admin/schedules',
    label: 'Schedules',
    isActive: pathname => pathname.startsWith('/admin/schedules'),
  },
  {
    href: '/admin/locations',
    label: 'Locations',
    isActive: pathname => pathname.startsWith('/admin/locations'),
  },
  {
    href: '/admin/users',
    label: 'Users',
    isActive: pathname =>
      pathname.startsWith('/admin/users') ||
      pathname.startsWith('/admin/players'),
  },
  {
    href: '/admin/analytics',
    label: 'Analytics',
    isActive: pathname => pathname.startsWith('/admin/analytics'),
  },
]
