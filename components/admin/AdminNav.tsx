'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const LINKS = [
  {
    href: '/admin/matches',
    label: 'Matches',
    isActive: (pathname: string) => pathname.startsWith('/admin/matches'),
  },
  {
    href: '/admin/schedules',
    label: 'Schedules',
    isActive: (pathname: string) => pathname.startsWith('/admin/schedules'),
  },
  {
    href: '/admin/locations',
    label: 'Locations',
    isActive: (pathname: string) => pathname.startsWith('/admin/locations'),
  },
  {
    href: '/admin/users',
    label: 'Users',
    isActive: (pathname: string) =>
      pathname.startsWith('/admin/users') ||
      pathname.startsWith('/admin/players'),
  },
  {
    href: '/admin/analytics',
    label: 'Analytics',
    isActive: (pathname: string) => pathname.startsWith('/admin/analytics'),
  },
] as const

export function AdminNav() {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const activeHref =
    LINKS.find(link => link.isActive(pathname))?.href ?? LINKS[0].href

  return (
    <nav aria-label="Admin sections" className="mb-8 min-w-0">
      <div className="sm:hidden">
        <Select
          value={activeHref}
          onValueChange={href => {
            if (href !== activeHref) router.push(href)
          }}
        >
          <SelectTrigger
            aria-label="Admin sections"
            className="h-11 w-full rounded-lg border-zinc-200 bg-zinc-50 font-semibold dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LINKS.map(link => (
              <SelectItem key={link.href} value={link.href}>
                {link.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="hidden min-w-0 gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900/50 sm:flex">
        {LINKS.map(link => {
          const active = link.isActive(pathname)
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'min-w-0 flex-1 rounded-md px-3 py-2 text-center text-sm font-semibold transition-colors',
                active
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              )}
            >
              {link.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
