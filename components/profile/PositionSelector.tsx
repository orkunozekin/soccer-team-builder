'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { SOCCER_POSITIONS } from '@/lib/constants/positions'

/** Sentinel value for "no position"; empty string is reserved by Radix Select for clearing. */
const NONE_POSITION_VALUE = '__none__'

interface PositionSelectorProps {
  value: string | null
  onValueChange: (value: string | null) => void
  disabled?: boolean
  hideLabel?: boolean
  labelClassName?: string
  triggerClassName?: string
}

export function PositionSelector({
  value,
  onValueChange,
  disabled = false,
  hideLabel = false,
  labelClassName,
  triggerClassName,
}: PositionSelectorProps) {
  return (
    <div className="space-y-1.5">
      {!hideLabel && (
        <Label htmlFor="position" className={labelClassName}>
          Position
        </Label>
      )}
      <Select
        value={value ?? NONE_POSITION_VALUE}
        onValueChange={(val) => onValueChange(val === NONE_POSITION_VALUE ? null : val)}
        disabled={disabled}
      >
        <SelectTrigger
          id="position"
          className={cn(
            'h-11 rounded-lg text-sm border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50',
            triggerClassName
          )}
        >
          <SelectValue placeholder="Select your position" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_POSITION_VALUE}>None</SelectItem>
          {SOCCER_POSITIONS.map((position) => (
            <SelectItem key={position.value} value={position.value}>
              {position.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
