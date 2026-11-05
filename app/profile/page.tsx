'use client'

import { type ReactNode, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { AttendanceStatsCard } from '@/components/profile/AttendanceStatsCard'
import { EmailUpdateForm } from '@/components/profile/EmailUpdateForm'
import { PasswordUpdateForm } from '@/components/profile/PasswordUpdateForm'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { ProfileSkillQuestionnaire } from '@/components/skill/ProfileSkillQuestionnaire'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Card } from '@/components/ui/card'
import { hasPasswordProvider } from '@/lib/firebase/auth'
import { useFeatureFlag } from '@/lib/flags/useFeatureFlag'
import { useAuth } from '@/lib/hooks/useAuth'

function ProfileSection({
  value,
  title,
  description,
  children,
}: {
  value: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card className="overflow-hidden rounded-xl border-border shadow-sm">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value={value} className="border-0">
          <AccordionTrigger className="px-6 py-4 hover:no-underline sm:px-8 sm:py-5">
            <span className="text-left">
              <span className="block text-base font-semibold tracking-tight text-foreground sm:text-lg">
                {title}
              </span>
              <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
                {description}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 sm:px-8 sm:pb-8">
            {children}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, userData, loading } = useAuth()
  const userId = user?.uid
  const showAccountSecurity = Boolean(user && hasPasswordProvider(user))
  const skillQuestionnaireEnabled = useFeatureFlag('skill-balanced-teams')

  useEffect(() => {
    if (!loading && !userId) {
      router.push('/login')
    }
  }, [userId, loading, router])

  if (loading) {
    return <PageLoadingSkeleton variant="container" />
  }

  if (!user || !userId) {
    return null
  }

  const displayName =
    userData?.displayName?.trim() ||
    user.displayName?.trim() ||
    user.email?.split('@')[0] ||
    'Player'
  const jerseyNumber = userData?.jerseyNumber

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-end gap-4 sm:gap-5">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-accent text-2xl font-bold tabular-nums text-foreground sm:h-20 sm:w-20 sm:text-3xl"
            aria-label={
              jerseyNumber == null
                ? 'No jersey number'
                : `Jersey number ${jerseyNumber}`
            }
          >
            {jerseyNumber == null ? '—' : jerseyNumber}
          </div>
          <div className="min-w-0 pb-0.5">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Profile
            </p>
            <h1 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {displayName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {jerseyNumber == null
                ? 'No jersey number set'
                : `Jersey #${jerseyNumber}`}
            </p>
          </div>
        </div>

        <AttendanceStatsCard userId={user.uid} />

        <ProfileSection
          value="edit-profile"
          title="Edit Profile"
          description="Display name, jersey number, and position"
        >
          <ProfileForm />
        </ProfileSection>

        {skillQuestionnaireEnabled && (
          <ProfileSection
            value="skill-questionnaire"
            title="Skill questionnaire"
            description="Helps admins balance teams by skill"
          >
            <ProfileSkillQuestionnaire key={userId} uid={userId} />
          </ProfileSection>
        )}

        {showAccountSecurity && (
          <>
            <ProfileSection
              value="email"
              title="Email"
              description="Change the email you use to sign in"
            >
              <EmailUpdateForm />
            </ProfileSection>

            <ProfileSection
              value="password"
              title="Password"
              description="Update your account password"
            >
              <PasswordUpdateForm />
            </ProfileSection>
          </>
        )}
      </div>
    </div>
  )
}
