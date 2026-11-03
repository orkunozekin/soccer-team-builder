'use client'

import Link from 'next/link'
import type { ClubWorkspaceStatus as Status } from '@/lib/hooks/useClubWorkspace'

export function ClubWorkspaceStatus({
  status,
  onNavigate,
}: {
  status: Status
  onNavigate?: () => void
}) {
  if (status.kind === 'loading') {
    return <p className="px-1 text-sm text-fog">Loading clubs…</p>
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
