import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SWRConfig } from 'swr'
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
  updateUserRoleAPI: (...args: unknown[]) => mocks.updateUserMock(...args),
}))

function renderUserRoleManager() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <UserRoleManager />
    </SWRConfig>
  )
}

describe('UserRoleManager', () => {
  beforeEach(() => {
    mocks.getUsersPaginatedMock.mockReset()
    mocks.getUsersCountMock.mockReset()
    mocks.updateUserMock.mockReset()
    mocks.searchUsersAPIMock.mockReset()
    mocks.deleteUserAPIMock.mockReset()
  })

  it('hides the current user from the list', async () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'u1' },
    })

    mocks.getUsersPaginatedMock.mockResolvedValue({
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
          role: 'super_user',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      nextCursor: null,
    })
    mocks.getUsersCountMock.mockResolvedValue(2)

    renderUserRoleManager()

    expect(await screen.findByText(/user two/i)).toBeInTheDocument()
    expect(screen.queryByText(/user one/i)).not.toBeInTheDocument()
  })

  it('caches paginated pages when navigating back', async () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'current' },
    })

    mocks.getUsersPaginatedMock
      .mockResolvedValueOnce({
        users: [
          {
            uid: 'u1',
            email: 'u1@example.com',
            displayName: 'Page One User',
            role: 'user',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        nextCursor: 'cursor-page-2',
      })
      .mockResolvedValueOnce({
        users: [
          {
            uid: 'u2',
            email: 'u2@example.com',
            displayName: 'Page Two User',
            role: 'user',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        nextCursor: null,
      })
    mocks.getUsersCountMock.mockResolvedValue(11)

    const user = userEvent.setup()
    renderUserRoleManager()

    expect(await screen.findByText(/page one user/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(await screen.findByText(/page two user/i)).toBeInTheDocument()
    expect(mocks.getUsersPaginatedMock).toHaveBeenCalledTimes(2)

    await user.click(screen.getByRole('button', { name: /previous/i }))
    expect(await screen.findByText(/page one user/i)).toBeInTheDocument()
    // SWR cache — no third fetch
    expect(mocks.getUsersPaginatedMock).toHaveBeenCalledTimes(2)
  })

  it('keeps previous when a later page only contains the signed-in user', async () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'current' },
    })

    mocks.getUsersPaginatedMock
      .mockResolvedValueOnce({
        users: [
          {
            uid: 'u1',
            email: 'u1@example.com',
            displayName: 'Page One User',
            role: 'user',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        nextCursor: 'cursor-page-2',
      })
      .mockResolvedValueOnce({
        users: [
          {
            uid: 'current',
            email: 'me@example.com',
            displayName: 'Just Me',
            role: 'super_user',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        nextCursor: null,
      })
    mocks.getUsersCountMock.mockResolvedValue(11)

    const user = userEvent.setup()
    renderUserRoleManager()

    expect(await screen.findByText(/page one user/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(await screen.findByText(/no users found/i)).toBeInTheDocument()
    expect(screen.queryByText(/just me/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /previous/i }))
    expect(await screen.findByText(/page one user/i)).toBeInTheDocument()
  })

  it('deletes a user via the dialog and updates the list', async () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'current' },
    })

    mocks.getUsersPaginatedMock.mockResolvedValue({
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
    mocks.getUsersCountMock.mockResolvedValue(1)
    mocks.deleteUserAPIMock.mockResolvedValue(undefined)

    const user = userEvent.setup()

    renderUserRoleManager()

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
