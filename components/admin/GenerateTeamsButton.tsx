'use client'

import { useState } from 'react'
import { generateTeamsAPI } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Match } from '@/types/match'

interface GenerateTeamsButtonProps {
  match: Match
  onTeamsGenerated?: () => void
}


export function GenerateTeamsButton({
  match,
  onTeamsGenerated,
}: GenerateTeamsButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      // Call API route (business logic is now on the server)
      await generateTeamsAPI(match.id)

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)

      if (onTeamsGenerated) {
        onTeamsGenerated()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate teams')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full h-11 sm:h-9"
      >
        {loading ? 'Generating Teams...' : 'Generate Teams'}
      </Button>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600 dark:text-green-400">
          Teams generated successfully!
        </p>
      )}
    </div>
  )
}
