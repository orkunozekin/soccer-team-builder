import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Navigation } from './Navigation'

const useAuthMock = vi.fn()
const useAdminMock = vi.fn()
const replace = vi.fn()
const logoutUser = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
}))

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/lib/hooks/useAdmin', () => ({
  useAdmin: () => useAdminMock(),
}))

vi.mock('@/lib/firebase/auth', () => ({
  logoutUser: (...args: unknown[]) => logoutUser(...args),
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
    expect(
      screen.queryByRole('link', { name: 'Matches' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Profile' })
    ).not.toBeInTheDocument()
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
    expect(
      screen.queryByRole('link', { name: 'Matches' })
    ).not.toBeInTheDocument()
  })

  it('sends signed-out users to the login form and clears a stuck pointer lock', async () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'u1' },
      loading: false,
    })
    logoutUser.mockResolvedValue(undefined)
    document.body.style.pointerEvents = 'none'
    document.body.setAttribute('data-scroll-locked', '1')
    document.body.classList.add('block-interactivity-1')

    render(<Navigation />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }))

    await waitFor(() => {
      expect(logoutUser).toHaveBeenCalledOnce()
      expect(replace).toHaveBeenCalledWith('/login')
    })
    expect(document.body.style.pointerEvents).toBe('')
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false)
    expect(document.body.classList.contains('block-interactivity-1')).toBe(
      false
    )
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
