import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SWRConfig } from 'swr'
import { UserRoleManager } from './UserRoleManager'

const useAuthMock = vi.fn()
vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

const useAdminMock = vi.fn()
vi.mock('@/lib/hooks/useAdmin', () => ({
  useAdmin: () => useAdminMock(),
}))

const mocks = vi.hoisted(() => {
  const getUsersPaginatedMock = vi.fn()
  const getUsersCountMock = vi.fn()
  const getUsersForAdminFilterMock = vi.fn()
  const getClubAdminUserIdsMock = vi.fn()
  const updateUserMock = vi.fn()
  const searchUsersAPIMock = vi.fn()
  const deleteUserAPIMock = vi.fn()
  return {
    getUsersPaginatedMock,
    getUsersCountMock,
    getUsersForAdminFilterMock,
    getClubAdminUserIdsMock,
    updateUserMock,
    searchUsersAPIMock,
    deleteUserAPIMock,
  }
})

vi.mock('@/lib/services/userService', () => ({
  getUsersPaginated: (...args: unknown[]) =>
    mocks.getUsersPaginatedMock(...args),
  getUsersCount: (...args: unknown[]) => mocks.getUsersCountMock(...args),
  getUsersForAdminFilter: (...args: unknown[]) =>
    mocks.getUsersForAdminFilterMock(...args),
  getClubAdminUserIds: (...args: unknown[]) =>
    mocks.getClubAdminUserIdsMock(...args),
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
    mocks.getUsersForAdminFilterMock.mockReset()
    mocks.getClubAdminUserIdsMock.mockReset()
    mocks.updateUserMock.mockReset()
    mocks.searchUsersAPIMock.mockReset()
    mocks.deleteUserAPIMock.mockReset()
    useAdminMock.mockReturnValue({ isSuperUser: false })
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

  it('hides the role filter from non-super users', async () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'current' },
    })
    useAdminMock.mockReturnValue({ isSuperUser: false })

    mocks.getUsersPaginatedMock.mockResolvedValue({
      users: [
        {
          uid: 'u1',
          email: 'u1@example.com',
          displayName: 'Regular User',
          role: 'user',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      nextCursor: null,
    })
    mocks.getUsersCountMock.mockResolvedValue(1)

    renderUserRoleManager()

    expect(await screen.findByText(/regular user/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('tablist', { name: /filter users/i })
    ).not.toBeInTheDocument()
    expect(mocks.getUsersForAdminFilterMock).not.toHaveBeenCalled()
  })

  it('shows the role filter for super users and switches lists', async () => {
    useAuthMock.mockReturnValue({
      user: { uid: 'current' },
    })
    useAdminMock.mockReturnValue({ isSuperUser: true })

    mocks.getUsersForAdminFilterMock
      .mockResolvedValueOnce([
        {
          uid: 'u1',
          email: 'u1@example.com',
          displayName: 'Plain User',
          role: 'user',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
      .mockResolvedValueOnce([
        {
          uid: 's1',
          email: 's1@example.com',
          displayName: 'Super Person',
          role: 'super_user',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
      .mockResolvedValueOnce([
        {
          uid: 'c1',
          email: 'c1@example.com',
          displayName: 'Club Admin Person',
          role: 'user',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
    mocks.getClubAdminUserIdsMock.mockResolvedValue(['c1'])

    const user = userEvent.setup()
    renderUserRoleManager()

    const filterTabs = await screen.findByRole('tablist', {
      name: /filter users/i,
    })
    expect(filterTabs).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: /^club admins$/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('tab', { name: /^super users$/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^users$/i })).toBeInTheDocument()

    expect(await screen.findByText(/plain user/i)).toBeInTheDocument()
    expect(mocks.getUsersForAdminFilterMock).toHaveBeenCalledWith('users')
    expect(mocks.getUsersPaginatedMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('tab', { name: /^super users$/i }))
    expect(await screen.findByText(/super person/i)).toBeInTheDocument()
    expect(screen.queryByText(/plain user/i)).not.toBeInTheDocument()
    expect(mocks.getUsersForAdminFilterMock).toHaveBeenCalledWith(
      'super_users'
    )

    await user.click(screen.getByRole('tab', { name: /^club admins$/i }))
    expect(await screen.findByText(/club admin person/i)).toBeInTheDocument()
    expect(mocks.getUsersForAdminFilterMock).toHaveBeenCalledWith(
      'club_admins'
    )
  })
})
