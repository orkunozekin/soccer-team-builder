'use client'

import { useState } from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { rebalanceTeamsAPI } from '@/lib/api/client'

export function RebalanceTeamsButton({
  matchId,
  onDone,
  variant = 'default',
  size = 'sm',
  className,
  showError = 'inline',
}: {
  matchId: string
  onDone: () => void
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
      await rebalanceTeamsAPI(matchId)
      onDone()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to rebalance teams')
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
        onClick={handleClick}
      >
        Rebalance teams
      </Button>
      {error && showError === 'inline' && (
        <div className="mt-2 text-xs text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}

