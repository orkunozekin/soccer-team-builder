'use client'

import { useEffect } from 'react'
import { notFound, useParams, useRouter } from 'next/navigation'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { ClubMatchesView } from '@/components/matches/ClubMatchesView'
import { useClubSlugAccess } from '@/lib/hooks/useClubSlugAccess'

function paramToString(
  value: string | string[] | undefined
): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0]) {
    return value[0]
  }
  return undefined
}

export default function ClubMatchesPage() {
  const params = useParams()
  const router = useRouter()
  const slug = paramToString(params?.slug)
  const access = useClubSlugAccess(slug)

  useEffect(() => {
    if (access.status === 'unauthenticated') {
      router.push('/login')
    }
  }, [access.status, router])

  if (access.status === 'loading' || access.status === 'unauthenticated') {
    return <PageLoadingSkeleton variant="container" />
  }

  if (access.status === 'forbidden') {
    notFound()
  }

  return (
    <ClubMatchesView clubId={access.club.id} clubSlug={access.club.slug} />
  )
}
