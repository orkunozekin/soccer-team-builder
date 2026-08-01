'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PlayerProfileDetails } from '@/components/admin/PlayerProfileDetails'
import { PlayerRsvpHistory } from '@/components/admin/PlayerRsvpHistory'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { AttendanceStatsCard } from '@/components/profile/AttendanceStatsCard'
import { BackLink } from '@/components/ui/back-link'
import { getUser } from '@/lib/services/userService'
import type { User } from '@/types/user'

export default function AdminPlayerProfilePage() {
  const params = useParams()
  const userId = params?.userId as string
  const [player, setPlayer] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setNotFound(false)
      try {
        const user = await getUser(userId)
        if (cancelled) return
        if (!user) {
          setNotFound(true)
          setPlayer(null)
        } else {
          setPlayer(user)
        }
      } catch {
        if (!cancelled) {
          setNotFound(true)
          setPlayer(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  if (loading) {
    return <PageLoadingSkeleton variant="container" />
  }

  if (notFound || !player) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-8">
        <BackLink href="/admin/users" label="Back to Users" />
        <div className="mt-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Player not found
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            This user may have been removed or the link is invalid.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-xl px-4 py-8 sm:py-10">
      <BackLink href="/admin/users" label="Back to Users" />

      <div className="mb-8 mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
          {player.displayName || 'Player'}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Player profile and attendance
        </p>
      </div>

      <div className="space-y-6">
        <PlayerProfileDetails user={player} />
        <AttendanceStatsCard userId={player.uid} />
        <PlayerRsvpHistory userId={player.uid} />
      </div>
    </div>
  )
}
