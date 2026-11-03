import { cn } from '@/lib/utils'
import { describeRosterFill, getRosterFill } from '@/lib/utils/rosterFill'

/** Segmented headcount bar: one segment per spot across the target teams. */
export function RosterFillMeter({
  confirmed,
  teamSize,
  className,
}: {
  confirmed: number
  teamSize?: number
  className?: string
}) {
  const fill = getRosterFill(confirmed, teamSize)
  const summary = `${fill.confirmed} of ${fill.capacity} spots filled`

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-display text-4xl font-extrabold leading-none">
          {fill.confirmed}
          <span className="text-dim"> / {fill.capacity}</span>
        </p>
        <p className="text-sm text-mist">{describeRosterFill(fill)}</p>
      </div>
      <div
        role="img"
        aria-label={summary}
        className="grid gap-[3px]"
        style={{
          gridTemplateColumns: `repeat(${fill.capacity}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: fill.capacity }, (_, i) => (
          <span
            key={i}
            data-filled={i < fill.confirmed}
            className={cn(
              'h-2.5 rounded-[3px]',
              i < fill.confirmed ? 'bg-red-50' : 'bg-line/70'
            )}
          />
        ))}
      </div>
    </div>
  )
}
