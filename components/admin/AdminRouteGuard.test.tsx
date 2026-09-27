import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminRouteGuard } from './AdminRouteGuard'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

const useAuthMock = vi.fn()
vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

const useAdminMock = vi.fn()
vi.mock('@/lib/hooks/useAdmin', () => ({
  useAdmin: () => useAdminMock(),
}))

describe('AdminRouteGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({
      user: { uid: 'user1' },
      loading: false,
    })
    useAdminMock.mockReturnValue({ isAdmin: true, rolePending: false })
  })

  it('renders admin content once the role is known', () => {
    render(
      <AdminRouteGuard>
        <div>Admin content</div>
      </AdminRouteGuard>
    )
    expect(screen.getByText('Admin content')).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('does not redirect while the user role is still loading', () => {
    useAdminMock.mockReturnValue({ isAdmin: false, rolePending: true })
    render(
      <AdminRouteGuard>
        <div>Admin content</div>
      </AdminRouteGuard>
    )
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('sends confirmed non-admins to /matches', async () => {
    useAdminMock.mockReturnValue({ isAdmin: false, rolePending: false })
    render(
      <AdminRouteGuard>
        <div>Admin content</div>
      </AdminRouteGuard>
    )
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/matches')
    })
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument()
  })
})