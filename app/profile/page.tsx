'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { AttendanceStatsCard } from '@/components/profile/AttendanceStatsCard'
import { EmailUpdateForm } from '@/components/profile/EmailUpdateForm'
import { PasswordUpdateForm } from '@/components/profile/PasswordUpdateForm'
import { ProfileClubsSection } from '@/components/profile/ProfileClubsSection'
import { ProfileForm } from '@/components/profile/ProfileForm'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Card } from '@/components/ui/card'
import { hasPasswordProvider } from '@/lib/firebase/auth'
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
    <Card className="overflow-hidden rounded-xl border-zinc-200 shadow-sm dark:border-zinc-800">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value={value} className="border-0">
          <AccordionTrigger className="px-6 py-4 hover:no-underline sm:px-8 sm:py-5">
            <span className="text-left">
              <span className="block text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-lg">
                {title}
              </span>
              <span className="mt-0.5 block text-sm font-normal text-zinc-500 dark:text-zinc-400">
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
  const showAccountSecurity = Boolean(user && hasPasswordProvider(user))

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return <PageLoadingSkeleton variant="container" />
  }

  if (!user) {
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
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-2xl font-bold tabular-nums text-white dark:bg-zinc-100 dark:text-zinc-900 sm:h-20 sm:w-20 sm:text-3xl"
            aria-label={
              jerseyNumber == null
                ? 'No jersey number'
                : `Jersey number ${jerseyNumber}`
            }
          >
            {jerseyNumber == null ? '—' : jerseyNumber}
          </div>
          <div className="min-w-0 pb-0.5">
            <p className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Profile
            </p>
            <h1 className="truncate text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
              {displayName}
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {jerseyNumber == null
                ? 'No jersey number set'
                : `Jersey #${jerseyNumber}`}
            </p>
          </div>
        </div>

        <AttendanceStatsCard userId={user.uid} />

        <ProfileSection
          value="clubs"
          title="Clubs"
          description="Memberships, invites, and clubs you admin"
        >
          <ProfileClubsSection />
        </ProfileSection>

        <ProfileSection
          value="edit-profile"
          title="Edit Profile"
          description="Display name, jersey number, and position"
        >
          <ProfileForm />
        </ProfileSection>

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
