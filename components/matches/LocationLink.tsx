'use client'

import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { locationDisplayName } from '@/lib/utils/location'
import { getMapsUrl } from '@/lib/utils/mapsLink'
import type { MatchLocation } from '@/types/match'

interface LocationLinkProps {
  location: MatchLocation
  className?: string
  /** Extra classes for the anchor text */
  linkClassName?: string
  showIcon?: boolean
}

export function LocationLink({
  location,
  className,
  linkClassName,
  showIcon = true,
}: LocationLinkProps) {
  const name = locationDisplayName(location)
  if (!name) return null

  return (
    <p
      className={cn(
        'flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400',
        className
      )}
    >
      {showIcon && <MapPin className="h-3.5 w-3.5 shrink-0 text-red-50" />}
      <a
        href={getMapsUrl(location)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'truncate font-medium text-red-60 underline-offset-2 hover:underline dark:text-red-40',
          linkClassName
        )}
        onClick={e => e.stopPropagation()}
      >
        {name}
      </a>
    </p>
  )
}
