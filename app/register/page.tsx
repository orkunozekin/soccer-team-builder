'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { SoccerBallIcon } from '@/components/icons/SoccerBallIcon'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

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
  const inviteCode = resolveInviteCode(
    searchParams.get('code'),
    redirectTo
  )
  const loginHref = redirectTo
    ? `/login?redirect=${encodeURIComponent(redirectTo)}`
    : inviteCode
      ? `/login?redirect=${encodeURIComponent(`/join?code=${encodeURIComponent(inviteCode)}`)}`
      : '/login'

  return (
    <div className="flex flex-col items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <div className="animate-slide-up-fade text-center">
          <div className="mb-4 flex justify-center">
            <SoccerBallIcon className="h-16 w-16 animate-float text-red-50" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-red-50">
            Join the Squad
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {inviteCode
              ? 'Create your account to join this club'
              : 'Create your account and start playing'}
          </p>
        </div>

        <Card
          className="card-soccer-accent animate-slide-up-fade shadow-lg"
          style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}
        >
          <CardHeader className="space-y-1">
            <CardTitle className="text-center text-2xl font-bold">
              Create Account
            </CardTitle>
            <CardDescription className="text-center">
              {inviteCode
                ? 'Your invite code is ready — finish signing up to join'
                : 'Sign up to join soccer pickup matches'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm
              inviteCode={inviteCode || null}
              redirectTo={
                redirectTo ??
                (inviteCode ? `/join?code=${encodeURIComponent(inviteCode)}` : null)
              }
            />
            <div className="mt-4 text-center text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                Already have an account?{' '}
              </span>
              <Link
                href={loginHref}
                className="font-medium text-red-50 hover:underline dark:text-red-400"
              >
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton variant="centered" />}>
      <RegisterPageInner />
    </Suspense>
  )
}
