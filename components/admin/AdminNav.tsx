'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  {
    href: '/admin/matches',
    label: 'Matches',
    isActive: (pathname: string) => pathname.startsWith('/admin/matches'),
  },
  {
    href: '/admin/users',
    label: 'Users',
    isActive: (pathname: string) =>
      pathname.startsWith('/admin/users') ||
      pathname.startsWith('/admin/players'),
  },
] as const

export function AdminNav() {
  const pathname = usePathname() ?? ''

  return (
    <nav
      aria-label="Admin sections"
      className="mb-8 flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900/50"
    >
      {LINKS.map(link => {
        const active = link.isActive(pathname)
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex-1 rounded-md px-3 py-2 text-center text-sm font-semibold transition-colors',
              active
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
