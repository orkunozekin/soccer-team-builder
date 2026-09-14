import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailUpdateForm } from './EmailUpdateForm'

const requestEmailUpdateMock = vi.fn()
const recordAuditEventAPIMock = vi.fn()
const useAuthMock = vi.fn()

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/lib/firebase/auth', () => ({
  hasPasswordProvider: (user: { providerData?: { providerId: string }[] }) =>
    Boolean(user.providerData?.some(p => p.providerId === 'password')),
  requestEmailUpdate: (...args: unknown[]) => requestEmailUpdateMock(...args),
  getAuthErrorMessage: (_err: unknown, fallback: string) => fallback,
}))

vi.mock('@/lib/api/client', () => ({
  recordAuditEventAPI: (...args: unknown[]) =>
    recordAuditEventAPIMock(...args),
}))

describe('EmailUpdateForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing for Google-only accounts', () => {
    useAuthMock.mockReturnValue({
      user: {
        email: 'googler@example.com',
        providerData: [{ providerId: 'google.com' }],
      },
      userData: { email: 'googler@example.com' },
    })

    const { container } = render(<EmailUpdateForm />)

    expect(container).toBeEmptyDOMElement()
  })

  it('requests an email update after reauth fields are filled', async () => {
    const user = userEvent.setup()
    const firebaseUser = {
      email: 'old@example.com',
      providerData: [{ providerId: 'password' }],
    }
    useAuthMock.mockReturnValue({
      user: firebaseUser,
      userData: { email: 'old@example.com' },
    })
    requestEmailUpdateMock.mockResolvedValue(undefined)

    render(<EmailUpdateForm />)

    await user.type(screen.getByLabelText('New Email'), 'new@example.com')
    await user.type(
      screen.getByLabelText('Current Password'),
      'current-pass'
    )
    await user.click(screen.getByRole('button', { name: /Update Email/i }))

    expect(requestEmailUpdateMock).toHaveBeenCalledWith(
      firebaseUser,
      'current-pass',
      'new@example.com'
    )
    expect(recordAuditEventAPIMock).toHaveBeenCalledWith({
      action: 'auth.email_change_requested',
    })
    expect(
      screen.getByText(/Check your new inbox for a confirmation link/i)
    ).toBeInTheDocument()
  })
})
