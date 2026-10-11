'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { applyFormationAPI } from '@/lib/api/client'
import { FORMATIONS } from '@/lib/constants/formations'

interface FormationSelectProps {
  matchId: string
  value?: string | null
  onApplied?: (formationId: string) => void
  disabled?: boolean
}

export function FormationSelect({
  matchId,
  value = null,
  onApplied,
  disabled = false,
}: FormationSelectProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [localValue, setLocalValue] = useState(value ?? '')

  useEffect(() => {
    setLocalValue(value ?? '')
  }, [value])

  const applyFormation = async (formationId: string) => {
    if (!formationId || busy) return
    const previous = localValue
    setLocalValue(formationId)
    setBusy(true)
    setError('')
    try {
      await applyFormationAPI(matchId, formationId)
      onApplied?.(formationId)
    } catch (err) {
      setLocalValue(previous)
      setError(
        err instanceof Error ? err.message : 'Failed to apply formation'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Formation
        </span>
        <Select
          value={localValue || undefined}
          onValueChange={id => {
            setLocalValue(id)
            void applyFormation(id)
          }}
          disabled={disabled || busy}
        >
          <SelectTrigger
            className="h-8 w-[8.5rem]"
            aria-label="Select team formation"
          >
            <SelectValue placeholder={busy ? 'Applying…' : 'Select'} />
          </SelectTrigger>
          <SelectContent>
            {FORMATIONS.map(f => (
              <SelectItem key={f.id} value={f.id}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          disabled={disabled || busy || !localValue}
          onClick={() => void applyFormation(localValue)}
        >
          {busy ? 'Applying…' : 'Apply'}
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  )
}
