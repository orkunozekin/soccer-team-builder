'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { useAdmin } from '@/lib/hooks/useAdmin'
import { logoutUser } from '@/lib/firebase/auth'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { NavLoadingSkeleton } from '@/components/LoadingSkeleton'
import { useState } from 'react'

export function Navigation() {
  const { user, userData, loading } = useAuth()
  const { isAdmin } = useAdmin()
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await logoutUser()
      router.push('/')
      setIsMenuOpen(false)
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  if (loading) {
    return <NavLoadingSkeleton />
  }

  if (!user) {
    return (
      <header className="sticky top-0 z-20 mb-4 flex items-center justify-center bg-red-50 py-2 font-semibold text-white">
        <div className="container mx-auto px-4">
          <div className="text-center">Jville Soccer Team Builder</div>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-20 mb-4 bg-red-50 py-2 font-semibold text-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <Link href="/matches" className="text-lg font-bold hover:opacity-80">
            Jville Soccer
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-4 md:flex">
            <Link
              href="/matches"
              className="hover:opacity-80 transition-opacity"
            >
              Matches
            </Link>
            <Link
              href="/profile"
              className="hover:opacity-80 transition-opacity"
            >
              Profile
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="hover:opacity-80 transition-opacity"
              >
                Admin
              </Link>
            )}
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="h-8 border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              Sign Out
            </Button>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden flex flex-col gap-1.5 p-2"
            aria-label="Toggle menu"
          >
            <span
              className={`block h-0.5 w-6 bg-white transition-all ${
                isMenuOpen ? 'rotate-45 translate-y-2' : ''
              }`}
            />
            <span
              className={`block h-0.5 w-6 bg-white transition-all ${
                isMenuOpen ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`block h-0.5 w-6 bg-white transition-all ${
                isMenuOpen ? '-rotate-45 -translate-y-2' : ''
              }`}
            />
          </button>
        </div>

        {/* Mobile Navigation Menu */}
        {isMenuOpen && (
          <nav className="mt-4 flex flex-col gap-2 border-t border-white/20 pt-4 md:hidden">
            <Link
              href="/matches"
              onClick={() => setIsMenuOpen(false)}
              className="py-2 hover:opacity-80 transition-opacity"
            >
              Matches
            </Link>
            <Link
              href="/profile"
              onClick={() => setIsMenuOpen(false)}
              className="py-2 hover:opacity-80 transition-opacity"
            >
              Profile
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setIsMenuOpen(false)}
                className="py-2 hover:opacity-80 transition-opacity"
              >
                Admin
              </Link>
            )}
            <Button
              onClick={handleLogout}
              variant="outline"
              className="mt-2 h-11 border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              Sign Out
            </Button>
          </nav>
        )}
      </div>
    </header>
  )
}
