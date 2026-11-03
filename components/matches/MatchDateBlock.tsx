import { format } from 'date-fns'
import { cn } from '@/lib/utils'

/**
 * Calendar-style date tile (weekday / day / month). Decorative: callers put
 * the full date in accessible text next to it.
 */
export function MatchDateBlock({
  date,
  showMonth = true,
  className,
}: {
  date: Date
  showMonth?: boolean
  className?: string
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'flex w-14 shrink-0 flex-col items-center rounded-xl border border-border bg-background py-2',
        className
      )}
    >
      <span className="font-mono text-[10px] tracking-[0.12em] text-fog">
        {format(date, 'EEE').toUpperCase()}
      </span>
      <span className="font-display text-[28px] font-black leading-none">
        {format(date, 'd')}
      </span>
      {showMonth ? (
        <span className="font-mono text-[10px] tracking-[0.12em] text-fog">
          {format(date, 'MMM').toUpperCase()}
        </span>
      ) : null}
    </div>
  )
}
