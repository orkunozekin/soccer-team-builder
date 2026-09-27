'use client'

import { useRouter } from 'next/navigation'
import { logoutUser } from '@/lib/firebase/auth'
import { useAuth } from '@/lib/hooks/useAuth'
import { cn } from '@/lib/utils'

/**
 * Radix Select/Dropdown/Sheet in the workspace chrome set `pointer-events: none`
 * (and a scroll lock) on body while open. Signing out unmounts that chrome
 * before the lock is released, which leaves the login page visible but unable
 * to take clicks or typing.
 */
function releasePageInteractionLock() {
  const { body } = document
  if (body.style.pointerEvents === 'none') {
    body.style.pointerEvents = ''
  }
  body.removeAttribute('data-scroll-locked')
  // className is a string. Spreading DOMTokenList fails `next build` typecheck
  // (target below es2015, no downlevelIteration).
  for (const className of body.className.split(/\s+/)) {
    if (className.startsWith('block-interactivity-')) {
      body.classList.remove(className)
    }
  }
}

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
      // Go straight to the login route. `/` only server-redirects there, and
      // that hop races the signed-out page's own redirect and can leave a
      // non-interactive skeleton on screen.
      router.replace('/login')
    } catch (error) {
      console.error('Error logging out:', error)
    } finally {
      releasePageInteractionLock()
      window.setTimeout(releasePageInteractionLock, 0)
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
