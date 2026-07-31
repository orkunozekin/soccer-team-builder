'use client'

import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { locationDisplayName } from '@/lib/utils/location'
import { getMapsUrl } from '@/lib/utils/mapsLink'
import type { MatchLocation } from '@/types/match'

interface LocationLinkProps {
  location: MatchLocation
  className?: string
  /** Extra classes for the clickable name */
  linkClassName?: string
  showIcon?: boolean
}

/**
 * Opens the device maps app. Uses a button (not <a>) so it can nest inside
 * Next.js Link / other anchors without invalid HTML.
 */
export function LocationLink({
  location,
  className,
  linkClassName,
  showIcon = true,
}: LocationLinkProps) {
  const name = locationDisplayName(location)
  if (!name) return null

  const openMaps = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()
    window.open(getMapsUrl(location), '_blank', 'noopener,noreferrer')
  }

  return (
    <p
      className={cn(
        'flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400',
        className
      )}
    >
      {showIcon && <MapPin className="h-3.5 w-3.5 shrink-0 text-red-50" />}
      <button
        type="button"
        className={cn(
          'truncate text-left font-medium text-red-60 underline-offset-2 hover:underline dark:text-red-40',
          linkClassName
        )}
        onClick={openMaps}
      >
        {name}
      </button>
    </p>
  )
}
