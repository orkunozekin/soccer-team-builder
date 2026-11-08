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
        © {new Date().getFullYear()}{' '}
        <a
          href="https://studioartemis.io"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm underline decoration-line underline-offset-4 outline-none hover:text-chalk hover:decoration-chalk focus-visible:ring-2 focus-visible:ring-ring"
        >
          Studio Artemis LLC
        </a>
        . All rights reserved.
      </p>
    </footer>
  )
}
