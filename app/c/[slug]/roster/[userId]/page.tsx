'use client'

import { useParams } from 'next/navigation'
import { ClubMemberProfile } from '@/components/club/ClubMemberProfile'
import {
  ClubSectionPage,
  paramToString,
} from '@/components/club/ClubSectionPage'
import { useClubSectionAccess } from '@/lib/hooks/useClubSectionAccess'

export default function ClubMemberPage() {
  const params = useParams()
  const slug = paramToString(params?.slug)
  const userId = paramToString(params?.userId)
  const access = useClubSectionAccess(slug, 'roster')

  return (
    <ClubSectionPage access={access}>
      {club =>
        userId ? (
          <ClubMemberProfile
            key={`${club.id}:${userId}`}
            clubId={club.id}
            clubSlug={club.slug}
            userId={userId}
          />
        ) : null
      }
    </ClubSectionPage>
  )
}
