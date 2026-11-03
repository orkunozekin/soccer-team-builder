'use client'

import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import type { ClubWorkspaceStatus as Status } from '@/lib/hooks/useClubWorkspace'
import { cn } from '@/lib/utils'

/**
 * Where the status renders, so the loading skeleton matches what replaces it:
 * - `card`: desktop rail club switcher
 * - `inline`: mobile header club switcher
 * - `nav`: mobile sheet club section links
 */
export type ClubWorkspaceStatusVariant = 'card' | 'inline' | 'nav'

const NAV_SKELETON_WIDTHS = ['w-20', 'w-16', 'w-14']

function ClubWorkspaceSkeleton({
  variant,
}: {
  variant: ClubWorkspaceStatusVariant
}) {
  const bone = 'bg-turf-raised motion-reduce:animate-none'

  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading clubs…</span>
      {variant === 'nav' ? (
        <div aria-hidden className="flex flex-col gap-1">
          {NAV_SKELETON_WIDTHS.map(width => (
            <div key={width} className="flex min-h-11 items-center gap-3 px-3">
              <Skeleton className={cn(bone, 'h-4 w-4 rounded')} />
              <Skeleton className={cn(bone, 'h-3.5', width)} />
            </div>
          ))}
        </div>
      ) : variant === 'inline' ? (
        <div aria-hidden className="flex min-h-11 items-center gap-2.5 px-1">
          <Skeleton className={cn(bone, 'h-8 w-8 rounded-lg')} />
          <Skeleton className={cn(bone, 'h-4 w-28')} />
        </div>
      ) : (
        <div
          aria-hidden
          className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-line/70 bg-turf px-3 py-2"
        >
          <Skeleton className={cn(bone, 'h-10 w-10 rounded-lg')} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className={cn(bone, 'h-3.5 w-3/4')} />
            <Skeleton className={cn(bone, 'h-3 w-1/3')} />
          </div>
        </div>
      )}
    </div>
  )
}

export function ClubWorkspaceStatus({
  status,
  onNavigate,
  variant = 'card',
}: {
  status: Status
  onNavigate?: () => void
  variant?: ClubWorkspaceStatusVariant
}) {
  if (status.kind === 'loading') {
    return <ClubWorkspaceSkeleton variant={variant} />
  }

  if (status.kind === 'error') {
    return (
      <div className="rounded-xl border border-line/70 bg-turf px-3 py-3 text-chalk">
        <p className="text-sm text-flare">{status.message}</p>
        <button
          type="button"
          onClick={status.onRetry}
          className="mt-2 text-sm font-semibold text-chalk underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    )
  }

  if (status.kind === 'empty') {
    return (
      <div className="rounded-xl border border-line/70 bg-turf px-3 py-3 text-chalk">
        <p className="text-sm text-mist">You are not in a club yet.</p>
        <Link
          href="/join"
          onClick={onNavigate}
          className="mt-2 inline-block text-sm font-semibold text-chalk underline underline-offset-2"
        >
          Join a club
        </Link>
      </div>
    )
  }

  return null
}
