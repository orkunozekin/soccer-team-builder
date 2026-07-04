import { cn } from '@/lib/utils'

interface SoccerBallIconProps {
  className?: string
}

export function SoccerBallIcon({ className }: SoccerBallIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <circle cx="32" cy="32" r="30" fill="white" stroke="currentColor" strokeWidth="2" />
      <path
        d="M32 8 L38 22 L32 28 L26 22 Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M32 56 L26 42 L32 36 L38 42 Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M8 32 L22 26 L28 32 L22 38 Z"
        fill="currentColor"
        opacity="0.7"
      />
      <path
        d="M56 32 L42 38 L36 32 L42 26 Z"
        fill="currentColor"
        opacity="0.7"
      />
      <path
        d="M14 14 L24 24 L20 30 L10 24 Z"
        fill="currentColor"
        opacity="0.5"
      />
      <path
        d="M50 50 L40 40 L44 34 L54 40 Z"
        fill="currentColor"
        opacity="0.5"
      />
      <path
        d="M50 14 L40 24 L44 30 L54 24 Z"
        fill="currentColor"
        opacity="0.5"
      />
      <path
        d="M14 50 L24 40 L20 34 L10 40 Z"
        fill="currentColor"
        opacity="0.5"
      />
    </svg>
  )
}
