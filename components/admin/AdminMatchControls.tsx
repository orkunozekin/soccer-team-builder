'use client'

import { useState } from 'react'
import { createMatchAPI } from '@/lib/api/client'
import { getMatch } from '@/lib/services/matchService'
import { useMatchStore } from '@/store/matchStore'
import { Button } from '@/components/ui/button'
import { DatePickerTime } from '@/components/ui/date-picker-time'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AdminMatchControlsProps {
  onMatchCreated?: () => void
}

export function AdminMatchControls({ onMatchCreated }: AdminMatchControlsProps) {
  const { addMatch } = useMatchStore()
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
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
      // Combine date and time in local time (avoid new Date(isoDate) which is UTC midnight and shifts the day in some timezones)
      const [y, m, d] = date.split('-').map(Number)
      const [hours, minutes] = time.split(':').map(Number)
      const matchDate = new Date(y, m - 1, d, hours, minutes, 0, 0)

      // Call API route (validation on server)
      const { matchId } = await createMatchAPI(matchDate, time)
      
      // Fetch the created match to add to store
      const newMatch = await getMatch(matchId)
      
      if (newMatch) {
        addMatch(newMatch)
      }

      setSuccess(true)
      setDate('')
      setTime('09:00')
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
          <DatePickerTime
            dateId="date"
            timeId="time"
            date={date}
            time={time}
            onDateChange={setDate}
            onTimeChange={setTime}
            datePlaceholder="Select date"
            disabled={loading}
            minDate={new Date(today + 'T12:00:00')}
            timeStep={300}
          />

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
