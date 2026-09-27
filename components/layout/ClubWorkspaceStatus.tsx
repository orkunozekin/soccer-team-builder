'use client'

import Link from 'next/link'
import type { ClubWorkspaceStatus as Status } from '@/lib/hooks/useClubWorkspace'

export function ClubWorkspaceStatus({ status }: { status: Status }) {
  if (status.kind === 'loading') {
    return (
      <p className="px-1 text-sm text-zinc-500 dark:text-zinc-400">
        Loading clubs…
      </p>
    )
  }

  if (status.kind === 'error') {
    return (
      <div className="rounded-md border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-red-700 dark:text-red-400">
          {status.message}
        </p>
        <button
          type="button"
          onClick={status.onRetry}
          className="mt-2 text-sm font-semibold text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
        >
          Try again
        </button>
      </div>
    )
  }

  if (status.kind === 'empty') {
    return (
      <div className="rounded-md border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          You are not in a club yet.
        </p>
        <Link
          href="/join"
          className="mt-2 inline-block text-sm font-semibold text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
        >
          Join a club
        </Link>
      </div>
    )
  }

  return null
}
