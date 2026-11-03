import { cn } from '@/lib/utils'

/** Soccerville mark: red ball badge + condensed wordmark. */
export function Wordmark({
  className,
  size = 'md',
}: {
  className?: string
  size?: 'md' | 'lg'
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        aria-hidden
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full bg-red-50',
          size === 'lg' ? 'h-8 w-8' : 'h-7 w-7'
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth={2}
          className={size === 'lg' ? 'h-[18px] w-[18px]' : 'h-4 w-4'}
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7l4 3-1.5 4.5h-5L8 10z" />
        </svg>
      </span>
      <span
        className={cn(
          'font-display font-black uppercase leading-none tracking-[0.04em]',
          size === 'lg' ? 'text-2xl' : 'text-[22px]'
        )}
      >
        Soccerville
      </span>
    </span>
  )
}
