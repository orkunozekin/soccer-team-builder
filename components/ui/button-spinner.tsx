'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ButtonSpinnerProps {
  className?: string
}

export function ButtonSpinner({ className }: ButtonSpinnerProps) {
  return (
    <Loader2 className={cn('h-4 w-4 animate-spin', className)} aria-hidden />
  )
}
