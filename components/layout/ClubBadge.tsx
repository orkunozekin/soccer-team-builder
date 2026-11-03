import { getInitials } from '@/components/ui/initials-avatar'
import { cn } from '@/lib/utils'

/** Square club crest stand-in: the club's initials in lime on turf. */
export function ClubBadge({
  name,
  size = 'md',
  className,
}: {
  name: string
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <span
      aria-hidden
      data-testid="club-badge"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg border border-line/60 bg-turf-raised font-display font-extrabold uppercase leading-none text-lime',
        size === 'sm' ? 'h-8 w-8 text-sm' : 'h-10 w-10 text-base',
        className
      )}
    >
      {getInitials(name)}
    </span>
  )
}
