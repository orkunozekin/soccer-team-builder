import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Pagination, getPageItems } from './pagination'

describe('getPageItems', () => {
  it('lists every page when there are few', () => {
    expect(getPageItems(1, 1)).toEqual([1])
    expect(getPageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('collapses distant pages into ellipses', () => {
    expect(getPageItems(1, 20)).toEqual([1, 2, 3, 4, 5, 'ellipsis-end', 20])
    expect(getPageItems(10, 20)).toEqual([
      1,
      'ellipsis-start',
      9,
      10,
      11,
      'ellipsis-end',
      20,
    ])
    expect(getPageItems(20, 20)).toEqual([
      1,
      'ellipsis-start',
      16,
      17,
      18,
      19,
      20,
    ])
  })
})

describe('Pagination', () => {
  const baseProps = {
    totalPages: 3,
    totalCount: 25,
    pageSize: 10,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
  }

  it('shows the page summary without numbered buttons by default', () => {
    render(<Pagination {...baseProps} page={2} itemLabel="users" />)
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Go to page 1' })
    ).not.toBeInTheDocument()
  })

  it('renders numbered buttons when onPageChange is provided', () => {
    const onPageChange = vi.fn()
    render(<Pagination {...baseProps} page={1} onPageChange={onPageChange} />)
    expect(
      screen.getByRole('button', { name: 'Go to page 1' })
    ).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 3' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 1' }))
    expect(onPageChange).toHaveBeenCalledTimes(1)
  })
})
