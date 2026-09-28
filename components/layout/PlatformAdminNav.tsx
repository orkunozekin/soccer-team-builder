'use client'

import {
  CalendarClock,
  CalendarDays,
  ChartColumn,
  type LucideIcon,
  MapPin,
  Users,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import { SidenavLink } from '@/components/layout/SidenavLink'
import { cn } from '@/lib/utils'
import { ADMIN_NAV_LINKS } from '@/lib/utils/adminNavLinks'

const ADMIN_NAV_ICONS: Record<string, LucideIcon> = {
  '/admin/matches': CalendarDays,
  '/admin/schedules': CalendarClock,
  '/admin/locations': MapPin,
  '/admin/users': Users,
  '/admin/analytics': ChartColumn,
}

/** Platform admin routes in the workspace rail and mobile sheet. */
export function PlatformAdminNav({
  onNavigate,
  className,
}: {
  onNavigate?: () => void
  className?: string
}) {
  const pathname = usePathname() ?? ''

  return (
    <nav
      aria-label="Admin sections"
      className={cn('flex flex-col gap-1', className)}
    >
      {ADMIN_NAV_LINKS.map(link => (
        <SidenavLink
          key={link.href}
          href={link.href}
          label={link.label}
          icon={ADMIN_NAV_ICONS[link.href]}
          active={link.isActive(pathname)}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  )
}
