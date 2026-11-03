import Link from 'next/link'
import { getInitials } from '@/components/ui/initials-avatar'
import { cn } from '@/lib/utils'

/** Round header shortcut to Profile: jersey number, or initials without one. */
export function ProfileBadge({
  displayName,
  jerseyNumber,
  className,
}: {
  displayName?: string | null
  jerseyNumber?: number | null
  className?: string
}) {
  const label =
    jerseyNumber != null ? String(jerseyNumber) : getInitials(displayName ?? '')
  return (
    <Link
      href="/profile"
      aria-label="Your profile"
      className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pinny-orange font-mono text-sm font-bold text-on-bright outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      {label}
    </Link>
  )
}
