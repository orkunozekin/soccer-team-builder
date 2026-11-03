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
    } catch {
      setError('Failed to rebalance teams')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={showError === 'block' ? 'space-y-2' : undefined}>
      {error && showError === 'block' && (
        <div className="rounded-md bg-danger-wash/20 p-3 text-sm text-danger">
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
        <div className="mt-2 text-xs text-danger">{error}</div>
      )}
    </div>
  )
}
