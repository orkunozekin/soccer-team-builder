'use client'

import { useParams } from 'next/navigation'
import {
  ClubSectionPage,
  paramToString,
} from '@/components/club/ClubSectionPage'
import { ClubSettingsPanel } from '@/components/club/ClubSettingsPanel'
import { useClubSectionAccess } from '@/lib/hooks/useClubSectionAccess'

export default function ClubSettingsPage() {
  const params = useParams()
  const slug = paramToString(params?.slug)
  const access = useClubSectionAccess(slug, 'settings')

  return (
    <ClubSectionPage access={access}>
      {club => (
        <ClubSettingsPanel
          clubId={club.id}
          clubName={club.name}
          initialAllowPlayerInvites={club.settings.allowPlayerInvites}
        />
      )}
    </ClubSectionPage>
  )
}
