import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RegisterForm } from './RegisterForm'

const registerUserMock = vi.fn()
const getAuthErrorMessageMock = vi.fn(
  (_err: unknown, fallback: string) => fallback
)
const recordAuditEventAPIMock = vi.fn()
const createUserMock = vi.fn()
const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/lib/firebase/auth', () => ({
  registerUser: (...args: unknown[]) => registerUserMock(...args),
  loginWithGoogle: vi.fn(),
  getAuthErrorMessage: (...args: unknown[]) => getAuthErrorMessageMock(...args),
}))

vi.mock('@/lib/api/client', () => ({
  recordAuditEventAPI: (...args: unknown[]) =>
    recordAuditEventAPIMock(...args),
  redeemInviteAPI: vi.fn(),
}))

vi.mock('@/lib/hooks/useClubMemberships', () => ({
  afterInviteRedeemed: vi.fn(),
}))

vi.mock('@/lib/services/userService', () => ({
  createUser: (...args: unknown[]) => createUserMock(...args),
  getUser: vi.fn(),
}))

vi.mock('@/store/authStore', () => ({
  useAuthStore: Object.assign(
    (selector: (state: { setUser: () => void }) => unknown) =>
      selector({ setUser: vi.fn() }),
    { getState: () => ({ userData: null, setUserData: vi.fn() }) }
  ),
}))

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthErrorMessageMock.mockImplementation(
      (_err: unknown, fallback: string) => fallback
    )
  })

  it('shows an explicit message when the email is already registered', async () => {
    const user = userEvent.setup()
    const authError = { code: 'auth/email-already-in-use' }
    registerUserMock.mockRejectedValue(authError)
    getAuthErrorMessageMock.mockReturnValue(
      'An account with this email already exists. Try signing in instead.'
    )

    render(<RegisterForm />)

    await user.type(screen.getByLabelText('Display Name'), 'Alex')
    await user.type(screen.getByLabelText('Email'), 'alex@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret1')
    await user.type(screen.getByLabelText('Confirm Password'), 'secret1')
    await user.click(screen.getByRole('button', { name: /Create Account/i }))

    expect(getAuthErrorMessageMock).toHaveBeenCalledWith(
      authError,
      'Failed to create account. Please try again.',
      'register'
    )
    expect(
      screen.getByText(
        'An account with this email already exists. Try signing in instead.'
      )
    ).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })
})
