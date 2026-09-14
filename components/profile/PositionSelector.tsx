'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SOCCER_POSITIONS } from '@/lib/constants/positions'
import { cn } from '@/lib/utils'

interface PositionSelectorProps {
  value: string | null
  onValueChange: (value: string | null) => void
  disabled?: boolean
  hideLabel?: boolean
  labelClassName?: string
  triggerClassName?: string
  /**
   * Optional per-position claim counts for the player's team.
   * Selecting an occupied position remains allowed; cues are informational.
   */
  occupancy?: Record<string, number>
}

function occupancyLabel(count: number | undefined): string | null {
  if (!count || count < 1) return null
  return `${count} claimed`
}

export function PositionSelector({
  value,
  onValueChange,
  disabled = false,
  hideLabel = false,
  labelClassName,
  triggerClassName,
  occupancy,
}: PositionSelectorProps) {
  return (
    <div className="space-y-1.5">
      {!hideLabel && (
        <Label htmlFor="position" className={labelClassName}>
          Position
        </Label>
      )}
      <Select
        value={value ?? ''}
        onValueChange={val => onValueChange(val === '' ? null : val)}
        disabled={disabled}
      >
        <SelectTrigger
          id="position"
          className={cn(
            'h-11 rounded-lg border-zinc-200 bg-zinc-50/50 text-sm dark:border-zinc-700 dark:bg-zinc-900/50',
            triggerClassName
          )}
        >
          <SelectValue placeholder="Select your position" />
        </SelectTrigger>
        <SelectContent>
          {SOCCER_POSITIONS.map(position => {
            const claimed = occupancyLabel(occupancy?.[position.value])
            return (
              <SelectItem key={position.value} value={position.value}>
                {claimed
                  ? `${position.label} · ${claimed}`
                  : position.label}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}
