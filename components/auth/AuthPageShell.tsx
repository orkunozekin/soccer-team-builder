import type { ComponentProps, ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Shared layout for sign-in, sign-up and password reset: a pitch-striped
 * hero headline over a single form panel.
 */
export function AuthPageShell({
  title,
  description,
  panelTitle,
  panelDescription,
  footer,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  panelTitle: string
  panelDescription?: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pitch-stripes pointer-events-none absolute inset-x-0 top-0 h-[24rem]"
      />
      <div className="relative mx-auto flex w-full max-w-md flex-col gap-8 px-4 pb-12 pt-10 sm:pt-16">
        <header className="animate-slide-up-fade">
          <h1 className="text-balance font-display text-6xl font-black uppercase leading-[0.88] sm:text-7xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 text-base text-mist">{description}</p>
          ) : null}
        </header>

        <section
          aria-labelledby="auth-panel-title"
          className="animate-slide-up-fade rounded-3xl border border-border bg-card/95 p-5 shadow-2xl shadow-elevation sm:p-6"
          style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}
        >
          <div className="mb-5 space-y-1">
            <h2
              id="auth-panel-title"
              className="font-display text-3xl font-extrabold uppercase leading-none"
            >
              {panelTitle}
            </h2>
            {panelDescription ? (
              <p className="text-sm text-fog">{panelDescription}</p>
            ) : null}
          </div>
          {children}
        </section>

        {footer ? (
          <p className="text-center text-sm text-fog">{footer}</p>
        ) : null}
      </div>
    </div>
  )
}

export function AuthFooterLink({
  className,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        'font-semibold text-chalk underline decoration-line underline-offset-4 hover:decoration-chalk',
        className
      )}
      {...props}
    />
  )
}
