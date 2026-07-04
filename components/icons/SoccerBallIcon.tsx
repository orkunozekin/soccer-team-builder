import { cn } from '@/lib/utils'

interface SoccerBallIconProps {
  className?: string
}

// Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Soccer_ball.svg (public domain)
const SOCCER_BALL_SRC = '/icons/soccer-ball.svg'

export function SoccerBallIcon({ className }: SoccerBallIconProps) {
  return (
    <img
      src={SOCCER_BALL_SRC}
      alt=""
      aria-hidden
      className={cn('shrink-0', className)}
    />
  )
}
