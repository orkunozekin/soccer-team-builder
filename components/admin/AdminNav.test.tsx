import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminNav } from './AdminNav'

const navMocks = vi.hoisted(() => ({
  pathname: '/admin/matches',
  push: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => navMocks.pathname,
  useRouter: () => ({ push: navMocks.push }),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
    [key: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

beforeAll(() => {
  // Radix Select uses Pointer Events APIs that jsdom does not implement.
  Object.assign(HTMLElement.prototype, {
    hasPointerCapture: () => false,
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    scrollIntoView: () => {},
  })
})

describe('AdminNav', () => {
  beforeEach(() => {
    navMocks.pathname = '/admin/matches'
    navMocks.push.mockReset()
  })

  it('renders a compact section picker and all section links', () => {
    navMocks.pathname = '/admin/matches'
    render(<AdminNav />)

    expect(
      screen.getByRole('navigation', { name: 'Admin sections' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: 'Admin sections' })
    ).toHaveTextContent('Matches')

    const nav = screen.getByRole('navigation', { name: 'Admin sections' })
    expect(within(nav).getByRole('link', { name: 'Matches' })).toHaveAttribute(
      'href',
      '/admin/matches'
    )
    expect(
      within(nav).getByRole('link', { name: 'Schedules' })
    ).toHaveAttribute('href', '/admin/schedules')
    expect(
      within(nav).getByRole('link', { name: 'Locations' })
    ).toHaveAttribute('href', '/admin/locations')
    expect(within(nav).getByRole('link', { name: 'Users' })).toHaveAttribute(
      'href',
      '/admin/users'
    )
    expect(
      within(nav).getByRole('link', { name: 'Analytics' })
    ).toHaveAttribute('href', '/admin/analytics')
  })

  it('marks the current section as the current page', () => {
    navMocks.pathname = '/admin/locations'
    render(<AdminNav />)

    const locations = screen.getByRole('link', { name: 'Locations' })
    expect(locations).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Matches' })).not.toHaveAttribute(
      'aria-current'
    )
    expect(
      screen.getByRole('combobox', { name: 'Admin sections' })
    ).toHaveTextContent('Locations')
  })

  it('treats player profile routes as the Users section', () => {
    navMocks.pathname = '/admin/players/user-1'
    render(<AdminNav />)

    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(
      screen.getByRole('combobox', { name: 'Admin sections' })
    ).toHaveTextContent('Users')
  })

  it('navigates when a section is chosen in the compact picker', async () => {
    navMocks.pathname = '/admin/matches'
    const user = userEvent.setup()
    render(<AdminNav />)

    await user.click(screen.getByRole('combobox', { name: 'Admin sections' }))
    await user.click(await screen.findByRole('option', { name: 'Analytics' }))

    expect(navMocks.push).toHaveBeenCalledWith('/admin/analytics')
  })

  it('does not navigate when the compact picker reselects the current section', async () => {
    navMocks.pathname = '/admin/matches'
    const user = userEvent.setup()
    render(<AdminNav />)

    await user.click(screen.getByRole('combobox', { name: 'Admin sections' }))
    await user.click(await screen.findByRole('option', { name: 'Matches' }))

    expect(navMocks.push).not.toHaveBeenCalled()
  })
})
