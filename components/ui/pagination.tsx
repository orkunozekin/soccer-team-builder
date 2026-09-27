'use client'

import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  totalPages: number
  totalCount: number
  pageSize: number
  onPrevious: () => void
  onNext: () => void
  /**
   * Enables numbered page buttons. Only pass this when any page can be loaded
   * directly (e.g. client-side pagination); cursor-based lists should omit it.
   */
  onPageChange?: (page: number) => void
  /** Label for the items (e.g. "users", "matches"). Used in "Showing 1–10 of 25 users" */
  itemLabel?: string
  className?: string
}

export type PageItem = number | 'ellipsis-start' | 'ellipsis-end'

/** First, last, and the current page ±1, with ellipses for the gaps. */
export function getPageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const start = Math.max(2, Math.min(page - 1, totalPages - 4))
  const end = Math.min(totalPages - 1, Math.max(page + 1, 5))
  const items: PageItem[] = [1]
  if (start > 2) items.push('ellipsis-start')
  for (let p = start; p <= end; p++) items.push(p)
  if (end < totalPages - 1) items.push('ellipsis-end')
  items.push(totalPages)
  return items
}

export function Pagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPrevious,
  onNext,
  onPageChange,
  itemLabel = 'items',
  className,
}: PaginationProps) {
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalCount)
  const hasPrev = page > 1
  const hasNext = page < totalPages

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Showing {start}–{end} of {totalCount} {itemLabel}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 pl-2"
          onClick={onPrevious}
          disabled={!hasPrev}
          aria-label="Go to previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Previous</span>
        </Button>
        {onPageChange ? (
          <>
            <span className="px-2 text-sm text-zinc-600 dark:text-zinc-400 sm:hidden">
              Page {page} of {totalPages}
            </span>
            <ul className="hidden items-center gap-1 sm:flex">
              {getPageItems(page, totalPages).map(item =>
                typeof item === 'number' ? (
                  <li key={item}>
                    <Button
                      type="button"
                      variant={item === page ? 'outline' : 'ghost'}
                      size="icon"
                      className={cn(
                        'h-8 w-8',
                        item === page &&
                          'border-zinc-300 font-semibold dark:border-zinc-700'
                      )}
                      onClick={() => {
                        if (item !== page) onPageChange(item)
                      }}
                      aria-label={`Go to page ${item}`}
                      aria-current={item === page ? 'page' : undefined}
                    >
                      {item}
                    </Button>
                  </li>
                ) : (
                  <li
                    key={item}
                    aria-hidden
                    className="flex h-8 w-8 items-center justify-center text-zinc-400"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </li>
                )
              )}
            </ul>
          </>
        ) : (
          <span className="px-2 text-sm text-zinc-600 dark:text-zinc-400">
            Page {page} of {totalPages}
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 pr-2"
          onClick={onNext}
          disabled={!hasNext}
          aria-label="Go to next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </nav>
  )
}
