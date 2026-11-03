'use client'

import { AuthFooterLink, AuthPageShell } from '@/components/auth/AuthPageShell'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell
      title="Back in the game."
      description="Reset your account password."
      panelTitle="Forgot password"
      panelDescription="We'll email you a link to choose a new password."
      footer={
        <>
          Remember your password?{' '}
          <AuthFooterLink href="/login">Sign in</AuthFooterLink>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthPageShell>
  )
}
