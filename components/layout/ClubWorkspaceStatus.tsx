'use client'

import Link from 'next/link'
import type { ClubWorkspaceStatus as Status } from '@/lib/hooks/useClubWorkspace'

export function ClubWorkspaceStatus({ status }: { status: Status }) {
  if (status.kind === 'loading') {
    return (
      <p className="px-1 text-sm text-white/80">
        Loading clubs…
      </p>
    )
  }

  if (status.kind === 'error') {
    return (
      <div className="rounded-md border border-white/30 bg-white px-3 py-3 text-zinc-900">
        <p className="text-sm text-red-40">{status.message}</p>
        <button
          type="button"
          onClick={status.onRetry}
          className="mt-2 text-sm font-semibold text-red-50 underline-offset-2 hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  if (status.kind === 'empty') {
    return (
      <div className="rounded-md border border-white/30 bg-white px-3 py-3 text-zinc-900">
        <p className="text-sm text-zinc-700">You are not in a club yet.</p>
        <Link
          href="/join"
          className="mt-2 inline-block text-sm font-semibold text-red-50 underline-offset-2 hover:underline"
        >
          Join a club
        </Link>
      </div>
    )
  }

  return null
}
