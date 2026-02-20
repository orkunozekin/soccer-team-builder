'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { getMatch } from '@/lib/services/matchService'
import { getMatchRSVPs } from '@/lib/services/rsvpService'
import { getMatchTeams } from '@/lib/services/teamService'
import { getAllUsers } from '@/lib/services/userService'
import { updateMatchAPI, deleteMatchAPI } from '@/lib/api/client'
import { useMatchStore } from '@/store/matchStore'
import { MatchDetails } from '@/components/matches/MatchDetails'
import { TeamsDisplay } from '@/components/teams/TeamsDisplay'
import { RSVPPollControls } from '@/components/admin/RSVPPollControls'
import { RebalanceTeamsButton } from '@/components/admin/RebalanceTeamsButton'
import { PlayerTransfer } from '@/components/admin/PlayerTransfer'
import { DatePickerTime } from '@/components/ui/date-picker-time'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { BackLink } from '@/components/ui/back-link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { ButtonSpinner } from '@/components/ui/button-spinner'
import { Team } from '@/types/team'
import { User } from '@/types/user'

export default function MatchDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const matchId = params?.matchId as string
  const { user, loading: authLoading } = useAuth()
  const { isAdmin } = useAdmin()
  const { currentMatch, setCurrentMatch, matchRSVPs, setMatchRSVPs, setLoading } =
    useMatchStore()
  const [loadingMatch, setLoadingMatch] = useState(true)
  const [teams, setTeams] = useState<Team[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [adminDate, setAdminDate] = useState('')
  const [adminTime, setAdminTime] = useState('')
  const [adminLocation, setAdminLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
      return
    }

    const fetchMatchData = async () => {
      if (!matchId || !user) return

      setLoadingMatch(true)
      setFetchError(null)
      try {
        const match = await getMatch(matchId)
        if (!match) {
          router.push('/matches')
          return
        }

        setCurrentMatch(match)

        try {
          const rsvps = await getMatchRSVPs(matchId)
          setMatchRSVPs(rsvps)
        } catch (e) {
          console.error('getMatchRSVPs failed:', e)
          setFetchError(`RSVPs: ${e instanceof Error ? e.message : String(e)}`)
        }

        try {
          const [matchTeams, users] = await Promise.all([
            getMatchTeams(matchId),
            getAllUsers(),
          ])
          setTeams(matchTeams)
          setAllUsers(users)
        } catch (e) {
          console.error('getMatchTeams or getAllUsers failed:', e)
          setFetchError(`Teams/Users: ${e instanceof Error ? e.message : String(e)}`)
        }
      } catch (error) {
        console.error('getMatch failed:', error)
        setFetchError(`Match: ${error instanceof Error ? error.message : String(error)}`)
        router.push('/matches')
        return
      } finally {
        setLoadingMatch(false)
        setLoadingTeams(false)
      }
    }

    fetchMatchData()
  }, [matchId, user, authLoading, router, setCurrentMatch, setMatchRSVPs])

  const refetchAll = async () => {
    if (!matchId) return
    try {
      const [matchData, rsvpsData, teamsData, usersData] = await Promise.all([
        getMatch(matchId),
        getMatchRSVPs(matchId),
        getMatchTeams(matchId),
        getAllUsers(),
      ])
      if (matchData) setCurrentMatch(matchData)
      setMatchRSVPs(rsvpsData)
      setTeams(teamsData)
      setAllUsers(usersData)
    } catch (e) {
      console.error('refetchAll failed:', e)
    }
  }

  useEffect(() => {
    if (!isAdmin || !currentMatch) return
    const d = new Date(currentMatch.date)
    setAdminDate(d.toISOString().slice(0, 10))
    setAdminTime(currentMatch.time || '')
    setAdminLocation(currentMatch.location || '')
  }, [isAdmin, currentMatch])

  const refetchTeams = async () => {
    if (!matchId) return
    const newTeams = await getMatchTeams(matchId)
    setTeams(newTeams)
  }

  const handleSaveDateTime = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!matchId || !currentMatch || !adminDate || !adminTime) return
    setSaving(true)
    setSaveSuccess(false)
    try {
      const [y, m, d] = adminDate.split('-').map(Number)
      const [h, min] = adminTime.split(':').map(Number)
      const matchDateTime = new Date(y, m - 1, d, h, min, 0, 0)
      await updateMatchAPI(matchId, {
        date: matchDateTime.toISOString(),
        time: adminTime,
        location: adminLocation.trim() || null,
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      await refetchAll()
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
      router.push('/matches')
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Failed to delete match')
    } finally {
      setDeleting(false)
    }
  }

  if (authLoading || loadingMatch) {
    return <PageLoadingSkeleton showBack variant="container" />
  }

  if (!user || !currentMatch) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-2">
      <BackLink href="/matches" label="Back to Matches" />

      <div className="mt-2 grid gap-10 lg:grid-cols-2 lg:gap-12">
        <div className="space-y-6">
          <MatchDetails match={currentMatch} rsvpCount={matchRSVPs.length} onTeamsRegenerated={refetchTeams} />

          {isAdmin && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Manage match</CardTitle>
                  <CardDescription>
                    Edit date, time, location, and RSVP window.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={handleSaveDateTime} className="space-y-4">
                    <DatePickerTime
                      dateId="match-date"
                      timeId="match-time"
                      date={adminDate}
                      time={adminTime}
                      onDateChange={setAdminDate}
                      onTimeChange={setAdminTime}
                      datePlaceholder="Select date"
                      disabled={saving}
                      timeStep={300}
                    />
                    <div className="space-y-2">
                      <Label htmlFor="match-location">Location</Label>
                      <Input
                        id="match-location"
                        type="text"
                        placeholder="e.g. Central Park Field 3"
                        value={adminLocation}
                        onChange={(e) => setAdminLocation(e.target.value)}
                        disabled={saving}
                        className="h-11"
                      />
                    </div>
                    {saveSuccess && (
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Date, time and location saved.
                      </p>
                    )}
                    <Button type="submit" disabled={saving}>
                      {saving ? <ButtonSpinner /> : 'Save date, time & location'}
                    </Button>
                  </form>
                  <div className="border-t pt-4">
                    <Button
                      variant="destructive"
                      className="w-full sm:w-auto"
                      loading={deleting}
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      Delete match
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete match?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the match, its teams, and RSVPs. This cannot be undone.
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
                      {deleting ? <ButtonSpinner /> : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <RSVPPollControls match={currentMatch} />
            </>
          )}
        </div>

        <div className="space-y-6">
          {!loadingTeams && teams.length > 0 && (
            <TeamsDisplay
              matchId={matchId}
              teams={teams}
              users={allUsers}
              isAdmin={isAdmin ?? false}
              onTeamsChanged={refetchAll}
              headerActions={
                isAdmin && teams.length >= 2 ? (
                  <RebalanceTeamsButton
                    matchId={matchId}
                    onDone={refetchAll}
                    size="sm"
                    showError="inline"
                  />
                ) : null
              }
            />
          )}
          {isAdmin && teams.length > 0 && (
            <PlayerTransfer
              matchId={matchId}
              teams={teams}
              users={allUsers}
              onTransferComplete={refetchAll}
            />
          )}
        </div>
      </div>
    </div>
  )
}
