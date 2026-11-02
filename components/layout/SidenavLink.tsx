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
        'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-turf-raised font-semibold text-chalk shadow-[inset_3px_0_0_theme(colors.red.50)]'
          : 'font-medium text-[#B9C2BD] hover:bg-turf hover:text-chalk'
      )}
    >
      {/* Cap height sits above the line-box center, so the icon is nudged up. */}
      <Icon className="h-4 w-4 shrink-0 -translate-y-px" aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  )
}
