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
      className={cn('mt-3 flex flex-col gap-1', className)}
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
              'rounded-md px-3 py-2 text-sm font-semibold transition-colors',
              active
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
