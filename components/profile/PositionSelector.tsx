'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { SOCCER_POSITIONS } from '@/lib/constants/positions'

interface PositionSelectorProps {
  value: string | null
  onValueChange: (value: string | null) => void
  disabled?: boolean
}

export function PositionSelector({
  value,
  onValueChange,
  disabled = false,
}: PositionSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="position">Position</Label>
      <Select
        value={value || ''}
        onValueChange={(val) => onValueChange(val || null)}
        disabled={disabled}
      >
        <SelectTrigger
          id="position"
          className="h-11 text-base sm:h-9 sm:text-sm"
        >
          <SelectValue placeholder="Select your position" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">None</SelectItem>
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
