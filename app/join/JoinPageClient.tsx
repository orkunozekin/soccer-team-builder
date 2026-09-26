'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { JoinClubForm } from '@/components/profile/ProfileClubsSection'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { previewInviteAPI, redeemInviteAPI } from '@/lib/api/client'
import { afterInviteRedeemed } from '@/lib/hooks/useClubMemberships'
import { useAuth } from '@/lib/hooks/useAuth'

export default function JoinPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const codeFromUrl = searchParams.get('code')?.trim() ?? ''
  const { user, loading } = useAuth()
  const [autoStatus, setAutoStatus] = useState<string | null>(null)
  const [autoError, setAutoError] = useState('')
  const [clubName, setClubName] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(Boolean(codeFromUrl))

  const joinPath = codeFromUrl
    ? `/join?code=${encodeURIComponent(codeFromUrl)}`
    : '/join'
  const registerHref = codeFromUrl
    ? `/register?code=${encodeURIComponent(codeFromUrl)}&redirect=${encodeURIComponent(joinPath)}`
    : '/register'
  const loginHref = `/login?redirect=${encodeURIComponent(joinPath)}`

  useEffect(() => {
    if (!codeFromUrl) {
      setClubName(null)
      setPreviewError('')
      setPreviewLoading(false)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError('')
    ;(async () => {
      try {
        const res = await previewInviteAPI(codeFromUrl)
        if (cancelled) return
        setClubName(res.clubName)
      } catch (err) {
        if (cancelled) return
        setClubName(null)
        setPreviewError(
          err instanceof Error ? err.message : 'Invalid or expired invite'
        )
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [codeFromUrl])

  useEffect(() => {
    // Preview is cosmetic (club name). Do not block redeem on previewError.
    if (loading || !user || !codeFromUrl || previewLoading) {
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await redeemInviteAPI(codeFromUrl)
        if (cancelled) return
        await afterInviteRedeemed({
          uid: user.uid,
          clubId: res.clubId,
          alreadyMember: res.alreadyMember,
        })
        if (cancelled) return
        setAutoStatus(
          res.alreadyMember
            ? clubName
              ? `You are already a member of ${clubName}.`
              : 'You are already a member of this club.'
            : clubName
              ? `Joined ${clubName} successfully.`
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
  }, [loading, user, codeFromUrl, previewLoading, clubName])

  if (loading || (codeFromUrl && previewLoading)) {
    return <PageLoadingSkeleton variant="centered" />
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle>
              {clubName ? `Join ${clubName}` : 'Join a club'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewError ? (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {previewError}. You can still sign in and try the invite code.
              </p>
            ) : clubName ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Sign in or create an account to join{' '}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {clubName}
                </span>
                .
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
            {previewError && (
              <Button asChild variant="outline">
                <Link href="/join">Enter a different code</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>
            {clubName ? `Join ${clubName}` : 'Join a club'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {autoError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
              {autoError}
            </div>
          )}
          {!autoError && previewError && codeFromUrl && !autoStatus && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Could not load the club name. Redeeming invite…
            </p>
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
            <p className="text-sm text-zinc-500">
              {clubName
                ? `Joining ${clubName}…`
                : 'Redeeming invite…'}
            </p>
          )}
          {autoError && (
            <JoinClubForm onJoined={() => router.push('/matches')} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
