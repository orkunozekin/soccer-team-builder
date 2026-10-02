'use client'

import { useCallback, useState } from 'react'

export const LIST_PAGE_SIZE = 10

/** Paginate already filtered/sorted data without changing its source order. */
export function useClientPagination<T>(items: T[], scope = '') {
  const [state, setState] = useState({ scope, page: 1 })
  const totalPages = Math.max(1, Math.ceil(items.length / LIST_PAGE_SIZE))
  const page = state.scope === scope ? Math.min(state.page, totalPages) : 1
  if (state.scope !== scope || state.page !== page) {
    setState({ scope, page })
  }
  const setPage = useCallback(
    (next: number) => setState({ scope, page: Math.max(1, next) }),
    [scope]
  )
  const offset = (page - 1) * LIST_PAGE_SIZE

  return {
    items: items.slice(offset, offset + LIST_PAGE_SIZE),
    offset,
    setPage,
    pagination: {
      page,
      totalPages,
      totalCount: items.length,
      pageSize: LIST_PAGE_SIZE,
      onPrevious: () => setPage(page - 1),
      onNext: () => setPage(Math.min(totalPages, page + 1)),
      onPageChange: setPage,
    },
  }
}
