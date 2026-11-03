import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Page title block shared by club, admin and account pages: optional mono
 * eyebrow (scope, e.g. "Super user"), condensed display title, description and
 * a trailing actions slot that wraps under the title on narrow screens.
 */
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  size = 'lg',
  className,
}: {
  title: ReactNode
  eyebrow?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  size?: 'md' | 'lg'
  className?: string
}) {
  return (
    <header
      className={cn(
        'mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4',
        className
      )}
    >
      <div className="min-w-0 flex-1 basis-72">
        {eyebrow ? (
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-fog">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={cn(
            'break-words font-display font-black uppercase leading-[0.9]',
            size === 'lg' ? 'text-5xl sm:text-6xl' : 'text-4xl sm:text-5xl'
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-[15px] text-mist">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  )
}
