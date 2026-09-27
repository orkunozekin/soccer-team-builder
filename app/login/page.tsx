'use client'

import { Suspense, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoginForm } from '@/components/auth/LoginForm'
import { SoccerBallIcon } from '@/components/icons/SoccerBallIcon'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
    <div className="flex flex-col items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <div className="animate-slide-up-fade text-center">
          <div className="mb-4 flex justify-center">
            <SoccerBallIcon className="h-20 w-20 animate-ball-spin" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-red-50 sm:text-5xl">
            Soccerville
          </h1>
          <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
            RSVP to games & get automatically assigned to balanced teams
          </p>
        </div>

        <Card className="card-soccer-accent shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-center text-2xl font-bold">
              Sign In
            </CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm redirectTo={redirectTo} />
            <div className="mt-4 text-center text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                Don&apos;t have an account?{' '}
              </span>
              <Link
                href={
                  redirectTo !== '/matches'
                    ? `/register?redirect=${encodeURIComponent(redirectTo)}`
                    : '/register'
                }
                className="font-medium text-red-50 hover:underline dark:text-red-400"
              >
                Sign up
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton variant="centered" />}>
      <LoginPageInner />
    </Suspense>
  )
}
