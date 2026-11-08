import { cn } from '@/lib/utils'

/** App-wide ownership notice shown at the bottom of every page. */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        'border-t border-line/60 px-4 py-6 text-center text-xs text-fog',
        className
      )}
    >
      {/* The year can differ between server and client render on Dec 31. */}
      <p suppressHydrationWarning>
        © {new Date().getFullYear()} Studio Artemis LLC. All rights reserved.
      </p>
    </footer>
  )
}
