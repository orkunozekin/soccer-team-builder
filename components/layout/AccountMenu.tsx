'use client'

import { ChevronDownIcon } from '@radix-ui/react-icons'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { logoutUser } from '@/lib/firebase/auth'
import { useAuth } from '@/lib/hooks/useAuth'
import { cn } from '@/lib/utils'
import {
  clubChromeBorderClass,
  clubChromeFgClass,
  clubChromeHoverClass,
} from '@/lib/utils/clubBranding'

/** Platform account links. Kept out of club section nav. */
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
      await logoutUser()
      router.push('/')
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account"
        className={cn(
          'inline-flex h-9 w-full max-w-full items-center justify-between gap-1 rounded-md border px-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--club-foreground)]',
          clubChromeBorderClass,
          clubChromeFgClass,
          clubChromeHoverClass,
          className
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDownIcon className="h-4 w-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/profile" onClick={onNavigate}>
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/clubs" onClick={onNavigate}>
            My clubs
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => {
            onNavigate?.()
            void handleLogout()
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
