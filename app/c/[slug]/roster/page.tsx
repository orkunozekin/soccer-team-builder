'use client'

import { useParams } from 'next/navigation'
import { ClubAdminRoster } from '@/components/club/ClubAdminRoster'
import {
  ClubSectionPage,
  paramToString,
} from '@/components/club/ClubSectionPage'
import { SkillRankingBoard } from '@/components/skill/SkillRankingBoard'
import { useFeatureFlag } from '@/lib/flags/useFeatureFlag'
import { useAuth } from '@/lib/hooks/useAuth'
import { useClubSectionAccess } from '@/lib/hooks/useClubSectionAccess'

export default function ClubRosterPage() {
  const params = useParams()
  const slug = paramToString(params?.slug)
  const access = useClubSectionAccess(slug, 'roster')
  const { user } = useAuth()
  const skillRankingEnabled = useFeatureFlag('skill-balanced-teams')

  return (
    <ClubSectionPage access={access}>
      {club => (
        <div className="space-y-8">
          <ClubAdminRoster
            clubId={club.id}
            clubSlug={club.slug}
            currentUserId={user?.uid ?? ''}
          />
          {skillRankingEnabled && <SkillRankingBoard clubId={club.id} />}
        </div>
      )}
    </ClubSectionPage>
  )
}
