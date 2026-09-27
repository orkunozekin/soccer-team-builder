'use client'

import { useEffect, type ReactNode } from 'react'
import { notFound, useRouter } from 'next/navigation'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { Button } from '@/components/ui/button'
import type { ClubSectionAccess } from '@/lib/hooks/useClubSectionAccess'
import type { Club } from '@/types/club'

function paramToString(
  value: string | string[] | undefined
): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0]) {
    return value[0]
  }
  return undefined
}

export { paramToString }

/**
 * Shared shell for `/c/[slug]/roster|invites|settings` pages.
 */
export function ClubSectionPage({
  access,
  children,
}: {
  access: ClubSectionAccess
  children: (club: Pick<Club, 'id' | 'name' | 'slug' | 'settings'>) => ReactNode
}) {
  const router = useRouter()

  useEffect(() => {
    if (access.status === 'unauthenticated') {
      router.push('/login')
    }
  }, [access.status, router])

  useEffect(() => {
    if (access.status === 'redirect') {
      router.replace(access.href)
    }
  }, [access, router])

  if (
    access.status === 'loading' ||
    access.status === 'unauthenticated' ||
    access.status === 'redirect'
  ) {
    return <PageLoadingSkeleton variant="container" />
  }

  if (access.status === 'error') {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-red-700 dark:text-red-400">
          Could not load club. {access.message}
        </p>
        <Button type="button" className="mt-3" onClick={() => access.retry()}>
          Try again
        </Button>
      </div>
    )
  }

  if (access.status === 'forbidden') {
    notFound()
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      {children(access.club)}
    </div>
  )
}
