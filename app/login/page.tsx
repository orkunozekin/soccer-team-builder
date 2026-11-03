'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthFooterLink, AuthPageShell } from '@/components/auth/AuthPageShell'
import { LoginForm } from '@/components/auth/LoginForm'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { useAuth } from '@/lib/hooks/useAuth'

function safeRedirectPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/matches'
  return raw
}

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = safeRedirectPath(searchParams.get('redirect'))
  const { isAuthenticated, loading } = useAuth()

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push(redirectTo)
    }
  }, [isAuthenticated, loading, router, redirectTo])

  if (loading) {
    return <PageLoadingSkeleton variant="centered" />
  }

  if (isAuthenticated) {
    return null
  }

  return (
    <AuthPageShell
      title={
        <>
          Show up.
          <br />
          <span className="text-flare">We&apos;ll pick</span>
          <br />
          the teams.
        </>
      }
      description="RSVP to games and get assigned to balanced teams automatically."
      panelTitle="Sign in"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <AuthFooterLink
            href={
              redirectTo !== '/matches'
                ? `/register?redirect=${encodeURIComponent(redirectTo)}`
                : '/register'
            }
          >
            Sign up
          </AuthFooterLink>
        </>
      }
    >
      <LoginForm redirectTo={redirectTo} />
    </AuthPageShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton variant="centered" />}>
      <LoginPageInner />
    </Suspense>
  )
}
