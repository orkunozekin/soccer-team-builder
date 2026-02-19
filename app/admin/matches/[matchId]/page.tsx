'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { format } from 'date-fns'
import { AdminRouteGuard } from '@/components/admin/AdminRouteGuard'
import { getMatch } from '@/lib/services/matchService'
import { getMatchTeams, getBench } from '@/lib/services/teamService'
import { getMatchRSVPs } from '@/lib/services/rsvpService'
import { getAllUsers } from '@/lib/services/userService'
import { generateTeamsAPI, deleteMatchAPI, updateMatchAPI } from '@/lib/api/client'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { RSVPPollControls } from '@/components/admin/RSVPPollControls'
import { DatePickerTime } from '@/components/ui/date-picker-time'
import { PlayerTransfer } from '@/components/admin/PlayerTransfer'
import { TeamsDisplay } from '@/components/teams/TeamsDisplay'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { BackLink } from '@/components/ui/back-link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Match } from '@/types/match'
import { Team } from '@/types/team'
import { User } from '@/types/user'

function AdminMatchManagementContent() {
  const router = useRouter()
  const params = useParams()
  const { isSuperAdmin } = useAdmin()
  const matchId = params?.matchId as string
  const [match, setMatch] = useState<Match | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [teams, setTeams] = useState<Team[]>([])
  const [benchPlayerIds, setBenchPlayerIds] = useState<string[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [rsvpCount, setRsvpCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const autoGenerateAttempted = useRef(false)

  const refreshData = async () => {
    if (!matchId) return

    try {
      const [matchData, teamsData, benchData, usersData, rsvpsData] = await Promise.all([
        getMatch(matchId),
        getMatchTeams(matchId),
        getBench(matchId),
        getAllUsers(),
        getMatchRSVPs(matchId),
      ])

      setMatch(matchData)
      setTeams(teamsData)
      setBenchPlayerIds(benchData?.playerIds || [])
      setAllUsers(usersData)
      setRsvpCount(rsvpsData.length)
      if (matchData) {
        const d = new Date(matchData.date)
        setDate(d.toISOString().slice(0, 10))
        setTime(matchData.time || '')
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!matchId) return
    refreshData()
  }, [matchId])

  // Auto-generate teams once when 2+ RSVPs and no teams yet
  useEffect(() => {
    if (!mounted || loading || !matchId || teams.length > 0 || autoGenerateAttempted.current) return

    let cancelled = false
    autoGenerateAttempted.current = true

    getMatchRSVPs(matchId).then((rsvps) => {
      if (cancelled || rsvps.length < 2) return
      generateTeamsAPI(matchId)
        .then(() => {
          if (!cancelled) refreshData()
        })
        .catch(() => {
          autoGenerateAttempted.current = false
        })
    })

    return () => {
      cancelled = true
    }
  }, [mounted, loading, matchId, teams.length])

  if (!mounted || loading) {
    return <PageLoadingSkeleton showBack variant="container" />
  }

  const handleSaveDateTime = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!matchId || !match || !date || !time) return
    setSaving(true)
    setSaveSuccess(false)
    try {
      const [y, m, d] = date.split('-').map(Number)
      const [h, min] = time.split(':').map(Number)
      const matchDateTime = new Date(y, m - 1, d, h, min, 0, 0)
      await updateMatchAPI(matchId, {
        date: matchDateTime.toISOString(),
        time,
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      await refreshData()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDeleteMatch = async () => {
    if (!matchId) return
    setDeleting(true)
    try {
      await deleteMatchAPI(matchId)
      setDeleteDialogOpen(false)
      router.push('/admin')
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Failed to delete match')
    } finally {
      setDeleting(false)
    }
  }

  if (!match) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Match not found</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <BackLink href="/admin" label="Back to Admin Dashboard" />

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Match Management</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Manage match settings, teams, and RSVP polls
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
        <div className="space-y-6">
          {isSuperAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Match date & time</CardTitle>
                <CardDescription>
                  Edit the match date and time. Only super admins see this.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleSaveDateTime} className="space-y-4">
                  <DatePickerTime
                    dateId="match-date"
                    timeId="match-time"
                    date={date}
                    time={time}
                    onDateChange={setDate}
                    onTimeChange={setTime}
                    datePlaceholder="Select date"
                    disabled={saving}
                    timeStep={300}
                  />
                  {saveSuccess && (
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Date and time saved.
                    </p>
                  )}
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save date & time'}
                  </Button>
                </form>
                <div className="border-t pt-4">
                  <Button
                    variant="destructive"
                    disabled={deleting}
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    {deleting ? 'Deleting...' : 'Delete match'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete match?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the match, its teams, bench, and RSVPs. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault()
                    handleConfirmDeleteMatch()
                  }}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <RSVPPollControls match={match} />
          {teams.length > 0 && (
            <PlayerTransfer
              matchId={matchId}
              teams={teams}
              users={allUsers}
              benchPlayerIds={benchPlayerIds}
              onTransferComplete={refreshData}
            />
          )}
        </div>

        <div>
          {teams.length > 0 && (
            <TeamsDisplay
              teams={teams}
              users={allUsers}
              benchPlayerIds={benchPlayerIds}
              isAdmin={true}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminMatchPage() {
  return (
    <AdminRouteGuard>
      <AdminMatchManagementContent />
    </AdminRouteGuard>
  )
}
