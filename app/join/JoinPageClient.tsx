'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { JoinClubForm } from '@/components/profile/ProfileClubsSection'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { redeemInviteAPI } from '@/lib/api/client'
import { useAuth } from '@/lib/hooks/useAuth'

export default function JoinPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const codeFromUrl = searchParams.get('code')?.trim() ?? ''
  const { user, loading } = useAuth()
  const [autoStatus, setAutoStatus] = useState<string | null>(null)
  const [autoError, setAutoError] = useState('')

  const joinPath = codeFromUrl
    ? `/join?code=${encodeURIComponent(codeFromUrl)}`
    : '/join'
  const registerHref = codeFromUrl
    ? `/register?code=${encodeURIComponent(codeFromUrl)}&redirect=${encodeURIComponent(joinPath)}`
    : '/register'
  const loginHref = `/login?redirect=${encodeURIComponent(joinPath)}`

  useEffect(() => {
    if (loading || !user || !codeFromUrl) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await redeemInviteAPI(codeFromUrl)
        if (cancelled) return
        setAutoStatus(
          res.alreadyMember
            ? 'You are already a member of this club.'
            : 'Joined club successfully.'
        )
      } catch (err) {
        if (cancelled) return
        setAutoError(
          err instanceof Error ? err.message : 'Failed to redeem invite'
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loading, user, codeFromUrl])

  if (loading) {
    return <PageLoadingSkeleton variant="centered" />
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle>Join a club</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {codeFromUrl ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Sign in or create an account to redeem invite code{' '}
                <span className="font-mono font-medium">{codeFromUrl}</span>.
              </p>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Sign in or create an account, then enter your invite code.
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="flex-1">
                <Link href={registerHref}>Create account</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href={loginHref}>Sign in</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Join a club</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {autoError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
              {autoError}
            </div>
          )}
          {autoStatus && (
            <div className="space-y-3">
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
                {autoStatus}
              </div>
              <Button type="button" onClick={() => router.push('/matches')}>
                Go to matches
              </Button>
            </div>
          )}
          {!codeFromUrl && !autoStatus && (
            <JoinClubForm onJoined={() => router.push('/matches')} />
          )}
          {codeFromUrl && !autoStatus && !autoError && (
            <p className="text-sm text-zinc-500">Redeeming invite…</p>
          )}
          {autoError && (
            <JoinClubForm onJoined={() => router.push('/matches')} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
