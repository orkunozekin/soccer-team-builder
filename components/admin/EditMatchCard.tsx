'use client'

import { useEffect, useMemo, useState } from 'react'
import { RSVPPollControls } from '@/components/admin/RSVPPollControls'
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
import { Button } from '@/components/ui/button'
import { ButtonSpinner } from '@/components/ui/button-spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DatePickerTime } from '@/components/ui/date-picker-time'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteMatchAPI, updateMatchAPI } from '@/lib/api/client'
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
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const initialValues = useMemo(() => {
    const d = new Date(match.date)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return {
      date: `${y}-${m}-${day}`,
      time: match.time || '',
      location: (match.location || '').trim(),
    }
  }, [match])

  useEffect(() => {
    setDate(initialValues.date)
    setTime(initialValues.time)
    setLocation(match.location || '')
  }, [match, initialValues.date, initialValues.time, initialValues.location])

  const hasChanges =
    date !== initialValues.date ||
    time !== initialValues.time ||
    (location || '').trim() !== initialValues.location

  const handleSaveDateTime = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!date || !time) return
    setSaving(true)
    setSaveSuccessMessage(null)
    try {
      const [y, m, d] = date.split('-').map(Number)
      const [h, min] = time.split(':').map(Number)
      const matchDateTime = new Date(y, m - 1, d, h, min, 0, 0)
      await updateMatchAPI(matchId, {
        date: matchDateTime.toISOString(),
        time,
        location: location.trim() || null,
      })
      const updated: string[] = []
      if (date !== initialValues.date) updated.push('Date')
      if (time !== initialValues.time) updated.push('Time')
      if ((location || '').trim() !== initialValues.location) updated.push('Location')
      const message =
        updated.length > 0
          ? `${updated.join(', ')} saved.`
          : 'Saved.'
      setSaveSuccessMessage(message)
      setTimeout(() => setSaveSuccessMessage(null), 3000)
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
                {saveSuccessMessage && (
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {saveSuccessMessage}
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
                  <Button type="submit" loading={saving} disabled={!hasChanges}>
                    Save
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
