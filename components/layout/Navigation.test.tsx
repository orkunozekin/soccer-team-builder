import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Navigation } from './Navigation'

const useAuthMock = vi.fn()
const useAdminMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/lib/hooks/useAdmin', () => ({
  useAdmin: () => useAdminMock(),
}))

vi.mock('@/lib/firebase/auth', () => ({
  logoutUser: vi.fn(),
}))

describe('Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAdminMock.mockReturnValue({ isAdmin: false })
  })

  it('shows a centered brand when signed out', () => {
    useAuthMock.mockReturnValue({ user: null, loading: false })
    render(<Navigation />)
    expect(screen.getByText('Soccerville')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Matches' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Profile' })).not.toBeInTheDocument()
  })

  it('keeps Profile on the platform bar and drops Matches', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'u1' },
      loading: false,
    })
    render(<Navigation />)
    expect(screen.getByRole('link', { name: 'Soccerville' })).toHaveAttribute(
      'href',
      '/matches'
    )
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/profile'
    )
    expect(screen.queryByRole('link', { name: 'Matches' })).not.toBeInTheDocument()
  })

  it('shows Admin for super users', () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'admin' },
      loading: false,
    })
    useAdminMock.mockReturnValue({ isAdmin: true })
    render(<Navigation />)
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute(
      'href',
      '/admin/matches'
    )
  })
})
