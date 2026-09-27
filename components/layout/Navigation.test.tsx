import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Navigation } from './Navigation'

const useAuthMock = vi.fn()

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

describe('Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('renders nothing when signed in (AppShell owns signed-in chrome)', () => {
    useAuthMock.mockReturnValue({ user: { uid: 'u1' }, loading: false })
    const { container } = render(<Navigation />)
    expect(container).toBeEmptyDOMElement()
  })
})
