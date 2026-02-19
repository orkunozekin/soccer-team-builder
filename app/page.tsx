'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  const router = useRouter()
  const { isAuthenticated, loading } = useAuth()

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push('/matches')
    }
  }, [isAuthenticated, loading, router])

  if (loading) {
    return <PageLoadingSkeleton variant="centered" />
  }

  if (isAuthenticated) {
    return null // Will redirect
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Soccerville
          </h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            RSVP to games & get automatically assigned to "balanced" teams
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one to join matches
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row">
            <Button asChild className="flex-1 h-11 text-base sm:h-9 sm:text-sm">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="flex-1 h-11 text-base sm:h-9 sm:text-sm"
            >
              <Link href="/register">Create Account</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
