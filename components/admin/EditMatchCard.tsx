'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePickerTime } from '@/components/ui/date-picker-time'
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
import { updateMatchAPI, deleteMatchAPI } from '@/lib/api/client'
import { RSVPPollControls } from '@/components/admin/RSVPPollControls'
import type { Match } from '@/types/match'

interface EditMatchCardProps {
  matchId: string
  match: Match
  onSaved?: () => void | Promise<void>
  onDeleted?: () => void
}

export function EditMatchCard({
  matchId,
  match,
  onSaved,
  onDeleted,
}: EditMatchCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const d = new Date(match.date)
    setDate(d.toISOString().slice(0, 10))
    setTime(match.time || '')
    setLocation(match.location || '')
  }, [match])

  const handleSaveDateTime = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!date || !time) return
    setSaving(true)
    setSaveSuccess(false)
    try {
      const [y, m, d] = date.split('-').map(Number)
      const [h, min] = time.split(':').map(Number)
      const matchDateTime = new Date(y, m - 1, d, h, min, 0, 0)
      await updateMatchAPI(matchId, {
        date: matchDateTime.toISOString(),
        time,
        location: location.trim() || null,
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      await onSaved?.()
    } catch {
      // Generic error; parent may show toast or rely on refetch
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    setDeleting(true)
    try {
      await deleteMatchAPI(matchId)
      setDeleteDialogOpen(false)
      onDeleted?.()
    } catch {
      alert('Failed to delete match')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Manage match</CardTitle>
          <CardDescription>
            Edit date, time, location, and RSVP window.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!expanded ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setExpanded(true)}
            >
              Manage match
            </Button>
          ) : (
            <div className="space-y-4">
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
                <div className="space-y-2">
                  <Label htmlFor="match-location">Location</Label>
                  <Input
                    id="match-location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    disabled={saving}
                    className="h-11"
                  />
                </div>
                {saveSuccess && (
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Date, time and location saved.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setExpanded(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" loading={saving}>
                    Save date, time & location
                  </Button>
                </div>
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
            </div>
          )}
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
                handleConfirmDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <ButtonSpinner /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RSVPPollControls match={match} />
    </>
  )
}
