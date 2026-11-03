import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountMenu } from './AccountMenu'
import { FeatureFlagContext } from '@/components/flags/FeatureFlagContext'

const replace = vi.fn()
const logoutUser = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
}))

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1', email: 'a@b.c' }, userData: null }),
}))

vi.mock('@/lib/api/client', () => ({
  updateProfileAPI: vi.fn(),
}))

vi.mock('@/lib/firebase/auth', () => ({
  logoutUser: (...args: unknown[]) => logoutUser(...args),
}))

describe('AccountMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends signed-out users to the login form and clears a stuck pointer lock', async () => {
    logoutUser.mockResolvedValue(undefined)
    const onNavigate = vi.fn()
    document.body.style.pointerEvents = 'none'
    document.body.setAttribute('data-scroll-locked', '1')
    document.body.classList.add('block-interactivity-1')

    render(<AccountMenu onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => {
      expect(logoutUser).toHaveBeenCalledOnce()
      expect(replace).toHaveBeenCalledWith('/login')
    })
    expect(onNavigate).toHaveBeenCalledOnce()
    expect(document.body.style.pointerEvents).toBe('')
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false)
    expect(document.body.classList.contains('block-interactivity-1')).toBe(
      false
    )
  })

  it('has no theme toggle while the light-theme flag is off', () => {
    render(<AccountMenu />)
    expect(screen.getByText('a@b.c')).toBeInTheDocument()
    expect(
      screen.queryByRole('group', { name: 'Theme' })
    ).not.toBeInTheDocument()
  })

  it('puts the theme toggle on the user name row without squeezing it', () => {
    render(
      <FeatureFlagContext.Provider value={{ 'light-theme': true }}>
        <AccountMenu />
      </FeatureFlagContext.Provider>
    )
    const name = screen.getByText('a@b.c')
    const group = screen.getByRole('group', { name: 'Theme' })
    expect(group.parentElement).toBe(name.parentElement)
    expect(name).toHaveClass('min-w-0', 'flex-1', 'truncate')
    expect(group).toHaveClass('shrink-0')
    expect(name.parentElement).toHaveClass('flex-wrap')
  })
})
