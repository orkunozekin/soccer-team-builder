import { cn } from '@/lib/utils'

/** First Unicode code point, so a surrogate pair is not split in half. */
function firstCharacter(word: string) {
  return Array.from(word)[0] ?? ''
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return Array.from(parts[0]).slice(0, 2).join('')
  return `${firstCharacter(parts[0])}${firstCharacter(parts[parts.length - 1])}`
}

export function InitialsAvatar({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
        className
      )}
    >
      {getInitials(name)}
    </div>
  )
}
