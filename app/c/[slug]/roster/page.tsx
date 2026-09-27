'use client'

import { useParams } from 'next/navigation'
import { ClubAdminRoster } from '@/components/club/ClubAdminRoster'
import {
  ClubSectionPage,
  paramToString,
} from '@/components/club/ClubSectionPage'
import { useAuth } from '@/lib/hooks/useAuth'
import { useClubSectionAccess } from '@/lib/hooks/useClubSectionAccess'

export default function ClubRosterPage() {
  const params = useParams()
  const slug = paramToString(params?.slug)
  const access = useClubSectionAccess(slug, 'roster')
  const { user } = useAuth()

  return (
    <ClubSectionPage access={access}>
      {club => (
        <ClubAdminRoster
          clubId={club.id}
          currentUserId={user?.uid ?? ''}
        />
      )}
    </ClubSectionPage>
  )
}
