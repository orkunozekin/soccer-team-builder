import * as React from 'react'
import { cn } from '@/lib/utils'

export interface FilterPillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean
}

/**
 * Pill toggle for list filters. Callers supply the selection semantics
 * (`aria-pressed` for a toggle group, or `role="tab"` + `aria-selected`).
 */
export const FilterPill = React.forwardRef<HTMLButtonElement, FilterPillProps>(
  ({ active, className, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      data-active={active}
      className={cn(
        'h-9 rounded-full px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-chalk text-ink'
          : 'border border-line text-mist hover:text-chalk',
        className
      )}
      {...props}
    />
  )
)
FilterPill.displayName = 'FilterPill'

/** Wrapping row for a group of FilterPills. */
export function FilterPillGroup({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-wrap gap-2', className)} {...props} />
}
