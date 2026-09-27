'use client'

import { useParams } from 'next/navigation'
import { ClubInvitesPanel } from '@/components/club/ClubInvitesPanel'
import {
  ClubSectionPage,
  paramToString,
} from '@/components/club/ClubSectionPage'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { useClubMemberships } from '@/lib/hooks/useClubMemberships'
import { useClubSectionAccess } from '@/lib/hooks/useClubSectionAccess'

export default function ClubInvitesPage() {
  const params = useParams()
  const slug = paramToString(params?.slug)
  const access = useClubSectionAccess(slug, 'invites')
  const { isSuperUser } = useAdmin()
  const { memberships } = useClubMemberships()

  return (
    <ClubSectionPage access={access}>
      {club => {
        const membership = memberships.find(
          m =>
            m.status === 'active' &&
            (m.clubId === club.id || m.club.slug === club.slug)
        )
        const canManageInvites =
          !!isSuperUser || membership?.role === 'club_admin'
        return (
          <ClubInvitesPanel
            clubId={club.id}
            canManageInvites={canManageInvites}
          />
        )
      }}
    </ClubSectionPage>
  )
}
