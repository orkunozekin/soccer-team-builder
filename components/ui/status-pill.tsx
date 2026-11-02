import * as React from 'react'
import { type VariantProps, cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const statusPillVariants = cva(
  'inline-flex max-w-full items-center gap-2 rounded-2xl border px-3 py-1 font-mono leading-snug text-[11px] font-medium uppercase tracking-[0.06em]',
  {
    variants: {
      tone: {
        live: 'border-[#4A1E19] bg-[#1E1412] text-[#FFB3AA]',
        success: 'border-[#3B5A22] bg-[#1A2A12] text-lime',
        neutral: 'border-line text-[#B9C2BD]',
        muted: 'border-line text-fog',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
)

export interface StatusPillProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillVariants> {}

/** Status label for RSVP windows, membership and roster states. */
export function StatusPill({
  className,
  tone,
  children,
  ...props
}: StatusPillProps) {
  return (
    <span className={cn(statusPillVariants({ tone }), className)} {...props}>
      {tone === 'live' ? (
        <span
          aria-hidden
          data-testid="status-pill-dot"
          className="h-2 w-2 shrink-0 rounded-full bg-flare shadow-[0_0_0_3px_rgba(255,90,74,0.18)] motion-safe:animate-badge-pulse"
        />
      ) : null}
      <span className="min-w-0">{children}</span>
    </span>
  )
}

export { statusPillVariants }
