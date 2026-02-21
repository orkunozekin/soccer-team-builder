'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DatePickerTime } from '@/components/ui/date-picker-time'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createMatchAPI } from '@/lib/api/client'
import { getMatch } from '@/lib/services/matchService'
import { useMatchStore } from '@/store/matchStore'

interface CreateMatchCardProps {
  onMatchCreated?: () => void
}

export function CreateMatchCard({ onMatchCreated }: CreateMatchCardProps) {
  const { addMatch } = useMatchStore()
  const [expanded, setExpanded] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [location, setLocation] = useState('')
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
      const [y, m, d] = date.split('-').map(Number)
      const [hours, minutes] = time.split(':').map(Number)
      const matchDate = new Date(y, m - 1, d, hours, minutes, 0, 0)

      const { matchId } = await createMatchAPI(matchDate, time, location.trim() || null)
      const newMatch = await getMatch(matchId)

      if (newMatch) {
        addMatch(newMatch)
      }

      setSuccess(true)
      setDate('')
      setTime('09:00')
      setLocation('')
      setTimeout(() => setSuccess(false), 3000)
      onMatchCreated?.()
    } catch {
      setError('Failed to create match')
    } finally {
      setLoading(false)
    }
  }

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
        {!expanded ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setExpanded(true)}
          >
            Add match
          </Button>
        ) : (
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

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={loading}
                className="h-11"
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

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setExpanded(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={loading}
                className="flex-1 h-11 text-base sm:h-9 sm:text-sm"
              >
                Create Match
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
