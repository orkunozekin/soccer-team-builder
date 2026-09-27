'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const ACCOUNT_LINKS = [
  {
    href: '/profile',
    label: 'Profile',
    isActive: (pathname: string) => pathname.startsWith('/profile'),
  },
  {
    href: '/clubs',
    label: 'My clubs',
    isActive: (pathname: string) => pathname.startsWith('/clubs'),
  },
] as const

/** Platform account destinations in the workspace rail and mobile sheet. */
export function AccountNav({
  onNavigate,
  className,
}: {
  onNavigate?: () => void
  className?: string
}) {
  const pathname = usePathname() ?? ''

  return (
    <nav
      aria-label="Account sections"
      className={cn('flex flex-col gap-1', className)}
    >
      {ACCOUNT_LINKS.map(link => {
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
