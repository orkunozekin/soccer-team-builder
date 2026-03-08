import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UserRoleManager } from './UserRoleManager'

const useAuthMock = vi.fn()
vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

const mocks = vi.hoisted(() => {
  const getUsersPaginatedMock = vi.fn()
  const getUsersCountMock = vi.fn()
  const updateUserMock = vi.fn()
  const searchUsersAPIMock = vi.fn()
  const deleteUserAPIMock = vi.fn()
  return {
    getUsersPaginatedMock,
    getUsersCountMock,
    updateUserMock,
    searchUsersAPIMock,
    deleteUserAPIMock,
  }
})

vi.mock('@/lib/services/userService', () => ({
  getUsersPaginated: (...args: unknown[]) =>
    mocks.getUsersPaginatedMock(...args),
  getUsersCount: (...args: unknown[]) => mocks.getUsersCountMock(...args),
  updateUser: (...args: unknown[]) => mocks.updateUserMock(...args),
}))

vi.mock('@/lib/api/client', () => ({
  searchUsersAPI: (...args: unknown[]) => mocks.searchUsersAPIMock(...args),
  deleteUserAPI: (...args: unknown[]) => mocks.deleteUserAPIMock(...args),
}))

describe('UserRoleManager', () => {
  it('hides the current user from the list', async () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'u1' },
    })

    mocks.getUsersPaginatedMock.mockResolvedValueOnce({
      users: [
        {
          uid: 'u1',
          email: 'u1@example.com',
          displayName: 'User One',
          role: 'user',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          uid: 'u2',
          email: 'u2@example.com',
          displayName: 'User Two',
          role: 'admin',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      nextCursor: null,
    })
    mocks.getUsersCountMock.mockResolvedValueOnce(2)

    render(<UserRoleManager />)

    await screen.findByText(/user management/i)

    expect(screen.getByText(/user two/i)).toBeInTheDocument()
    expect(screen.queryByText(/user one/i)).not.toBeInTheDocument()
  })

  it('deletes a user via the dialog and updates the list', async () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'current' },
    })

    mocks.getUsersPaginatedMock.mockResolvedValueOnce({
      users: [
        {
          uid: 'u-del',
          email: 'del@example.com',
          displayName: 'Delete Me',
          role: 'user',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      nextCursor: null,
    })
    mocks.getUsersCountMock.mockResolvedValueOnce(1)
    mocks.deleteUserAPIMock.mockResolvedValueOnce(undefined)

    const user = userEvent.setup()

    render(<UserRoleManager />)

    await screen.findByText(/delete me/i)

    const removeButton = screen.getByRole('button', {
      name: /remove delete me/i,
    })
    await user.click(removeButton)

    const confirm = await screen.findByRole('button', { name: /remove user/i })
    await user.click(confirm)

    await waitFor(() => {
      expect(mocks.deleteUserAPIMock).toHaveBeenCalledWith('u-del')
      expect(screen.queryByText(/delete me/i)).not.toBeInTheDocument()
    })
  })
})
