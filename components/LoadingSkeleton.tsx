'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface PageLoadingSkeletonProps {
  /** Show a short “back” link skeleton at the top */
  showBack?: boolean
  /** Layout: 'centered' for auth/guard (narrow), 'container' for normal pages */
  variant?: 'centered' | 'container'
}

/** Full-page skeleton for initial load (auth, data fetch). */
export function PageLoadingSkeleton({
  showBack = false,
  variant = 'container',
}: PageLoadingSkeletonProps) {
  const content = (
    <div className="space-y-6">
      {showBack && <Skeleton className="h-4 w-32" />}
      <div className="space-y-2">
        <Skeleton className="h-8 w-3/4 max-w-md" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
      <div
        className={
          variant === 'centered'
            ? 'mx-auto max-w-2xl space-y-4'
            : 'grid gap-6 lg:grid-cols-2'
        }
      >
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
        {variant === 'container' && (
          <Skeleton className="h-40 w-full rounded-lg lg:col-span-2" />
        )}
      </div>
    </div>
  )

  if (variant === 'centered') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl space-y-6">
          <div className="space-y-2 text-center">
            <Skeleton className="mx-auto h-10 w-64" />
            <Skeleton className="mx-auto h-5 w-80" />
          </div>
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto min-h-screen px-4 py-8">{content}</div>
  )
}

/** In-card skeleton for sections that load data (e.g. user list). */
export function CardLoadingSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}

/** Minimal header skeleton for nav while auth is loading. */
export function NavLoadingSkeleton() {
  return (
    <header className="sticky top-0 z-20 mb-4 flex items-center justify-center bg-red-50 py-2 font-semibold text-white">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48 rounded bg-white/20" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16 rounded bg-white/20" />
            <Skeleton className="h-8 w-20 rounded bg-white/20" />
          </div>
        </div>
      </div>
    </header>
  )
}
