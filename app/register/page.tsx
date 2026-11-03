'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AuthFooterLink, AuthPageShell } from '@/components/auth/AuthPageShell'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { previewInviteAPI } from '@/lib/api/client'

function safeRedirectPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null
  return raw
}

/** Prefer explicit ?code=, else parse code from redirect=/join?code=… */
function resolveInviteCode(
  codeParam: string | null,
  redirect: string | null
): string {
  const direct = codeParam?.trim()
  if (direct) return direct
  if (!redirect) return ''
  try {
    const url = new URL(redirect, 'http://local.invalid')
    return url.searchParams.get('code')?.trim() ?? ''
  } catch {
    return ''
  }
}

function RegisterPageInner() {
  const searchParams = useSearchParams()
  const redirectTo = safeRedirectPath(searchParams.get('redirect'))
  const inviteCode = resolveInviteCode(searchParams.get('code'), redirectTo)
  const loginHref = redirectTo
    ? `/login?redirect=${encodeURIComponent(redirectTo)}`
    : inviteCode
      ? `/login?redirect=${encodeURIComponent(`/join?code=${encodeURIComponent(inviteCode)}`)}`
      : '/login'

  const [clubName, setClubName] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(Boolean(inviteCode))

  useEffect(() => {
    if (!inviteCode) {
      setClubName(null)
      setPreviewLoading(false)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    ;(async () => {
      try {
        const res = await previewInviteAPI(inviteCode)
        if (!cancelled) setClubName(res.clubName)
      } catch {
        if (!cancelled) setClubName(null)
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [inviteCode])

  if (inviteCode && previewLoading) {
    return <PageLoadingSkeleton variant="centered" />
  }

  return (
    <AuthPageShell
      title={clubName ? `Join ${clubName}` : 'Join the squad.'}
      description={
        clubName
          ? `Create your account to join ${clubName}`
          : inviteCode
            ? 'Create your account to join this club'
            : 'Create your account and start playing'
      }
      panelTitle="Create account"
      panelDescription={
        clubName
          ? `Finish signing up to join ${clubName}`
          : inviteCode
            ? 'Your invite is ready — finish signing up to join'
            : 'Sign up to join soccer pickup matches'
      }
      footer={
        <>
          Already have an account?{' '}
          <AuthFooterLink href={loginHref}>Sign in</AuthFooterLink>
        </>
      }
    >
      <RegisterForm
        inviteCode={inviteCode || null}
        redirectTo={
          redirectTo ??
          (inviteCode ? `/join?code=${encodeURIComponent(inviteCode)}` : null)
        }
      />
    </AuthPageShell>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton variant="centered" />}>
      <RegisterPageInner />
    </Suspense>
  )
}
