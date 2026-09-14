import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PasswordUpdateForm } from './PasswordUpdateForm'

const updateUserPasswordMock = vi.fn()
const recordAuditEventAPIMock = vi.fn()
const useAuthMock = vi.fn()

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/lib/firebase/auth', () => ({
  hasPasswordProvider: (user: { providerData?: { providerId: string }[] }) =>
    Boolean(user.providerData?.some(p => p.providerId === 'password')),
  updateUserPassword: (...args: unknown[]) => updateUserPasswordMock(...args),
  getAuthErrorMessage: (_err: unknown, fallback: string) => fallback,
}))

vi.mock('@/lib/api/client', () => ({
  recordAuditEventAPI: (...args: unknown[]) =>
    recordAuditEventAPIMock(...args),
}))

describe('PasswordUpdateForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing for Google-only accounts', () => {
    useAuthMock.mockReturnValue({
      user: {
        email: 'googler@example.com',
        providerData: [{ providerId: 'google.com' }],
      },
    })

    const { container } = render(<PasswordUpdateForm />)

    expect(container).toBeEmptyDOMElement()
  })

  it('validates that passwords match before calling Firebase', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue({
      user: {
        email: 'player@example.com',
        providerData: [{ providerId: 'password' }],
      },
    })

    render(<PasswordUpdateForm />)

    await user.type(screen.getByLabelText('Current Password'), 'oldpass1')
    await user.type(screen.getByLabelText('New Password'), 'newpass1')
    await user.type(screen.getByLabelText('Confirm New Password'), 'newpass2')
    await user.click(screen.getByRole('button', { name: /Update Password/i }))

    expect(updateUserPasswordMock).not.toHaveBeenCalled()
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
  })

  it('updates the password when inputs are valid', async () => {
    const user = userEvent.setup()
    const firebaseUser = {
      email: 'player@example.com',
      providerData: [{ providerId: 'password' }],
    }
    useAuthMock.mockReturnValue({ user: firebaseUser })
    updateUserPasswordMock.mockResolvedValue(undefined)

    render(<PasswordUpdateForm />)

    await user.type(screen.getByLabelText('Current Password'), 'oldpass1')
    await user.type(screen.getByLabelText('New Password'), 'newpass1')
    await user.type(screen.getByLabelText('Confirm New Password'), 'newpass1')
    await user.click(screen.getByRole('button', { name: /Update Password/i }))

    expect(updateUserPasswordMock).toHaveBeenCalledWith(
      firebaseUser,
      'oldpass1',
      'newpass1'
    )
    expect(recordAuditEventAPIMock).toHaveBeenCalledWith({
      action: 'auth.password_changed',
    })
    expect(screen.getByText('Password updated.')).toBeInTheDocument()
  })
})
