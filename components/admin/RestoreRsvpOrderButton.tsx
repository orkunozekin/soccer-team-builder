'use client'

import { useState } from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { generateTeamsAPI } from '@/lib/api/client'

export function RestoreRsvpOrderButton({
  matchId,
  onDone,
  disabled = false,
  variant = 'outline',
  size = 'sm',
  className,
  showError = 'inline',
}: {
  matchId: string
  onDone: () => void
  disabled?: boolean
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  className?: string
  showError?: 'inline' | 'block' | 'none'
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setError(null)
    setLoading(true)
    try {
      await generateTeamsAPI(matchId)
      onDone()
    } catch {
      setError('Failed to restore RSVP order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={showError === 'block' ? 'space-y-2' : undefined}>
      {error && showError === 'block' && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        loading={loading}
        disabled={disabled}
        onClick={handleClick}
      >
        Restore RSVP order
      </Button>
      {error && showError === 'inline' && (
        <div className="mt-2 text-xs text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}
