'use client'

import { useRouter } from 'next/navigation'
import { logoutUser } from '@/lib/firebase/auth'
import { useAuth } from '@/lib/hooks/useAuth'
import { cn } from '@/lib/utils'

/**
 * Account footer for the workspace rail / mobile sheet.
 * Profile and My clubs live in AccountNav; this only signs out.
 */
export function AccountMenu({
  className,
  onNavigate,
}: {
  className?: string
  onNavigate?: () => void
}) {
  const { user, userData } = useAuth()
  const router = useRouter()
  const label = userData?.displayName?.trim() || user?.email || 'Account'

  const handleLogout = async () => {
    try {
      onNavigate?.()
      await logoutUser()
      router.push('/')
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      <p className="truncate px-1 text-xs font-medium text-white/80">{label}</p>
      <button
        type="button"
        aria-label="Sign out"
        onClick={() => {
          void handleLogout()
        }}
        className="inline-flex h-9 w-full items-center justify-center rounded-md border border-white px-2 text-sm font-medium text-white outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"
      >
        Sign out
      </button>
    </div>
  )
}
