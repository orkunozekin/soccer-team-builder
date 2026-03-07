'use client'

import { Button } from '@/components/ui/button'

interface PaginationProps {
  page: number
  totalPages: number
  totalCount: number
  pageSize: number
  onPrevious: () => void
  onNext: () => void
  /** Label for the items (e.g. "users", "matches"). Used in "Showing 1–10 of 25 users" */
  itemLabel?: string
}

export function Pagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPrevious,
  onNext,
  itemLabel = 'items',
}: PaginationProps) {
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalCount)
  const hasPrev = page > 1
  const hasNext = page < totalPages

  return (
    <div className="flex flex-col gap-3 border-t pt-4 mt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Showing {start}–{end} of {totalCount} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={!hasPrev}
        >
          Previous
        </Button>
        <span className="text-sm text-zinc-600 dark:text-zinc-400 px-2">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!hasNext}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
