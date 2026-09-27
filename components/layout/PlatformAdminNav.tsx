'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ADMIN_NAV_LINKS } from '@/lib/utils/adminNavLinks'

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
      {ADMIN_NAV_LINKS.map(link => {
        const active = link.isActive(pathname)
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
            className={cn(
              'rounded-md border-l-[6px] px-3 py-2 text-sm font-semibold transition-colors',
              active
                ? 'border-white bg-white/20 text-white'
                : 'border-transparent text-white hover:bg-white/10'
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
