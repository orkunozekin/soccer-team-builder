import * as React from 'react'
import { cn } from '@/lib/utils'

type GoogleIconProps = React.SVGProps<SVGSVGElement>

export function GoogleIcon({ className, ...props }: GoogleIconProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      className={cn('h-4 w-4', className)}
      {...props}
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.1 0 5.7 1.1 7.8 3.1l5.8-5.8C34.3 3.3 29.6 1.5 24 1.5 14.8 1.5 7 6.7 3.1 14.3l6.8 5.3C11.6 13.6 17.3 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-2.8-.4-4.1H24v7.8h12.7c-.3 2-1.7 5-4.9 7.1l7.4 5.7c4.4-4.1 7.3-10.1 7.3-16.5z"
      />
      <path
        fill="#FBBC05"
        d="M9.9 28.1c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-6.8-5.3C1.8 16.4 1 20.1 1 23.5s.8 7.1 2.1 10l6.8-5.4z"
      />
      <path
        fill="#34A853"
        d="M24 45.5c5.6 0 10.3-1.8 13.7-4.9l-7.4-5.7c-2 1.4-4.7 2.4-6.3 2.4-6.7 0-12.4-4.1-14.1-10l-6.8 5.3C7 40.3 14.8 45.5 24 45.5z"
      />
    </svg>
  )
}
