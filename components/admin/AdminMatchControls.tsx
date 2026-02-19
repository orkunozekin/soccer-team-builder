'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { createMatch, updateMatch } from '@/lib/services/matchService'
import { useMatchStore } from '@/store/matchStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AdminMatchControlsProps {
  onMatchCreated?: () => void
}

export function AdminMatchControls({ onMatchCreated }: AdminMatchControlsProps) {
  const { addMatch } = useMatchStore()
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!date || !time) {
      setError('Please provide both date and time')
      return
    }

    setLoading(true)

    try {
      // Combine date and time
      const [hours, minutes] = time.split(':')
      const matchDate = new Date(date)
      matchDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)

      const matchId = await createMatch(matchDate, time, false)
      
      // Fetch the created match to add to store
      const { getMatch } = await import('@/lib/services/matchService')
      const newMatch = await getMatch(matchId)
      
      if (newMatch) {
        addMatch(newMatch)
      }

      setSuccess(true)
      setDate('')
      setTime('')
      setTimeout(() => setSuccess(false), 3000)

      if (onMatchCreated) {
        onMatchCreated()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create match')
    } finally {
      setLoading(false)
    }
  }

  // Set default date to today
  const today = new Date().toISOString().split('T')[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Match</CardTitle>
        <CardDescription>
          Create a new soccer match with date and time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={today}
              required
              disabled={loading}
              className="h-11 text-base sm:h-9 sm:text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              disabled={loading}
              className="h-11 text-base sm:h-9 sm:text-sm"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
              Match created successfully!
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 text-base sm:h-9 sm:text-sm"
          >
            {loading ? 'Creating...' : 'Create Match'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
