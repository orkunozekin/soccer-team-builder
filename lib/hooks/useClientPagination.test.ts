import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useClientPagination } from './useClientPagination'

const items = Array.from({ length: 23 }, (_, i) => i + 1)

describe('useClientPagination', () => {
  it('navigates pages and preserves absolute offsets', () => {
    const { result } = renderHook(() => useClientPagination(items))
    expect(result.current.items).toEqual(items.slice(0, 10))
    act(() => result.current.pagination.onPageChange(3))
    expect(result.current.items).toEqual([21, 22, 23])
    expect(result.current.offset).toBe(20)
    act(() => result.current.pagination.onPrevious())
    expect(result.current.items).toEqual(items.slice(10, 20))
  })

  it('clamps after removal and does not jump back when the list grows', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useClientPagination(data),
      { initialProps: { data: items } }
    )
    act(() => result.current.setPage(3))
    rerender({ data: items.slice(0, 11) })
    expect(result.current.items).toEqual([11])
    rerender({ data: items })
    expect(result.current.pagination.page).toBe(2)
    rerender({ data: [] })
    expect(result.current.pagination.page).toBe(1)
    expect(result.current.items).toEqual([])
  })

  it('resets when the club or filter changes', () => {
    const { result, rerender } = renderHook(
      ({ scope }) => useClientPagination(items, scope),
      { initialProps: { scope: 'club-a:all' } }
    )
    act(() => result.current.setPage(2))
    rerender({ scope: 'club-b:upcoming' })
    expect(result.current.pagination.page).toBe(1)
  })
})
