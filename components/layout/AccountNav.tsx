'use client'

import { Building2, type LucideIcon, User } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { SidenavLink } from '@/components/layout/SidenavLink'
import { cn } from '@/lib/utils'

const ACCOUNT_LINKS: {
  href: string
  label: string
  icon: LucideIcon
  isActive: (pathname: string) => boolean
}[] = [
  {
    href: '/profile',
    label: 'Profile',
    icon: User,
    isActive: pathname => pathname.startsWith('/profile'),
  },
  {
    href: '/clubs',
    label: 'My clubs',
    icon: Building2,
    isActive: pathname => pathname.startsWith('/clubs'),
  },
]

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
      {ACCOUNT_LINKS.map(link => (
        <SidenavLink
          key={link.href}
          href={link.href}
          label={link.label}
          icon={link.icon}
          active={link.isActive(pathname)}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  )
}
