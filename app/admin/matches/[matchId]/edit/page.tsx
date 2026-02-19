'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AdminRouteGuard } from '@/components/admin/AdminRouteGuard'
import { getMatch } from '@/lib/services/matchService'
import { updateMatchAPI } from '@/lib/api/client'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DatePickerTime } from '@/components/ui/date-picker-time'
import { Match } from '@/types/match'
import { format } from 'date-fns'

function EditMatchContent() {
  const router = useRouter()
  const params = useParams()
  const matchId = params?.matchId as string
  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Form state: date and time as separate inputs; dates for rsvp as ISO date strings
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [rsvpOpen, setRsvpOpen] = useState(false)
  const [rsvpOpenAt, setRsvpOpenAt] = useState('')
  const [rsvpCloseAt, setRsvpCloseAt] = useState('')

  useEffect(() => {
    if (!matchId) return
    getMatch(matchId)
      .then((m) => {
        setMatch(m)
        if (m) {
          const d = new Date(m.date)
          setDate(d.toISOString().slice(0, 10))
          setTime(m.time || '')
          setRsvpOpen(m.rsvpOpen ?? false)
          setRsvpOpenAt(m.rsvpOpenAt ? format(m.rsvpOpenAt, "yyyy-MM-dd'T'HH:mm") : '')
          setRsvpCloseAt(m.rsvpCloseAt ? format(m.rsvpCloseAt, "yyyy-MM-dd'T'HH:mm") : '')
        }
      })
      .catch(() => setMatch(null))
      .finally(() => setLoading(false))
  }, [matchId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!matchId || !match) return
    setError('')
    setSuccess(false)
    setSaving(true)
    try {
      // Build match datetime in local time so the calendar day doesn't shift (avoid new Date(isoDate) = UTC midnight)
      const [y, m, d] = date.split('-').map(Number)
      const [h, min] = time.split(':').map(Number)
      const matchDateTime = new Date(y, m - 1, d, h, min, 0, 0)

      const payload: Parameters<typeof updateMatchAPI>[1] = {
        date: matchDateTime.toISOString(),
        time,
        rsvpOpen,
        rsvpOpenAt: rsvpOpenAt ? new Date(rsvpOpenAt).toISOString() : null,
        rsvpCloseAt: rsvpCloseAt ? new Date(rsvpCloseAt).toISOString() : null,
      }
      await updateMatchAPI(matchId, payload)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update match')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <PageLoadingSkeleton showBack variant="container" />
  }

  if (!match) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Match not found</p>
        <button
          onClick={() => router.push('/admin')}
          className="mt-4 text-sm text-zinc-600 hover:underline"
        >
          ← Back to Admin
        </button>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-lg px-4 py-8">
      <button
        onClick={() => router.push(`/admin/matches/${matchId}`)}
        className="mb-6 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
      >
        ← Back to Match
      </button>

      <Card>
        <CardHeader>
          <CardTitle>Edit Match</CardTitle>
          <CardDescription>
            Update date, time, and RSVP window. Only super admins can edit matches.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <DatePickerTime
              dateId="date"
              timeId="time"
              date={date}
              time={time}
              onDateChange={setDate}
              onTimeChange={setTime}
              datePlaceholder="Select date"
              disabled={saving}
              timeStep={300}
            />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rsvpOpen"
                checked={rsvpOpen}
                onChange={(e) => setRsvpOpen(e.target.checked)}
                disabled={saving}
                className="rounded border-zinc-300"
              />
              <Label htmlFor="rsvpOpen">RSVP open (manual override)</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rsvpOpenAt">RSVP open at (optional)</Label>
              <Input
                id="rsvpOpenAt"
                type="datetime-local"
                step={600}
                value={rsvpOpenAt}
                onChange={(e) => setRsvpOpenAt(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rsvpCloseAt">RSVP close at (optional)</Label>
              <Input
                id="rsvpCloseAt"
                type="datetime-local"
                step={600}
                value={rsvpCloseAt}
                onChange={(e) => setRsvpCloseAt(e.target.value)}
                disabled={saving}
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            {success && (
              <p className="text-sm text-green-600 dark:text-green-400">
                Match updated successfully.
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/admin/matches/${matchId}`)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function EditMatchPage() {
  return (
    <AdminRouteGuard requireSuperAdmin>
      <EditMatchContent />
    </AdminRouteGuard>
  )
}
