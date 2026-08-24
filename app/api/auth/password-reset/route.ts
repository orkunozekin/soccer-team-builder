import { NextRequest, NextResponse } from 'next/server'
import { sanitizeErrorForClient } from '@/lib/api/sanitizeError'
import { buildPasswordResetEmailHtml } from '@/lib/email/passwordResetTemplate'
import { sendPlunkEmail } from '@/lib/email/plunk'
import { getAdminAuth } from '@/lib/firebase/admin'
import { auditLog } from '@/lib/services/auditService'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getContinueUrl(): string {
  const base =
    process.env.PASSWORD_RESET_CONTINUE_URL?.trim() ||
    process.env.BASE_URL?.trim() ||
    'https://www.soccerville.club'
  return `${base.replace(/\/$/, '')}/login`
}

/**
 * POST /api/auth/password-reset
 * Generates a Firebase password-reset link and emails it via Plunk.
 *
 * Body: { email }
 * Always returns { ok: true } for valid emails (avoids account enumeration).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const email =
      typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    const adminAuth = getAdminAuth()
    if (!adminAuth) {
      return NextResponse.json(
        { error: 'Password reset is not available right now.' },
        { status: 500 }
      )
    }

    try {
      const resetLink = await adminAuth.generatePasswordResetLink(email, {
        url: getContinueUrl(),
        handleCodeInApp: false,
      })

      await sendPlunkEmail({
        to: email,
        subject: 'Reset your Soccerville password',
        body: buildPasswordResetEmailHtml({
          email,
          resetLink,
        }),
      })

      auditLog({
        action: 'auth.password_reset_requested',
        actorUid: 'anonymous',
        source: 'api',
        metadata: { emailDomain: email.split('@')[1] ?? 'unknown' },
      })
    } catch (error: unknown) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: string }).code)
          : ''

      // Unknown accounts and invalid emails should look like success.
      if (
        code === 'auth/user-not-found' ||
        code === 'auth/invalid-email'
      ) {
        return NextResponse.json({ ok: true })
      }

      throw error
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Password reset email failed:', error)
    return NextResponse.json(
      {
        error: sanitizeErrorForClient(
          error,
          'Could not send a reset email. Please try again.'
        ),
      },
      { status: 500 }
    )
  }
}
