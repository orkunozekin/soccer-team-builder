import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

/** Shared rail / sheet tab. Icons stay decorative so the link name is the label. */
export function SidenavLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: {
  href: string
  label: string
  icon: LucideIcon
  active: boolean
  onNavigate?: () => void
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-2 rounded-md border-l-[6px] px-3 py-2 text-sm font-semibold transition-colors',
        active
          ? 'border-white bg-white/20 text-white'
          : 'border-transparent text-white hover:bg-white/10'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  )
}
