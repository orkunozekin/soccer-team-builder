'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { logoutUser } from '@/lib/firebase/auth'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function MatchesPage() {
  const { user, userData, loading } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await logoutUser()
      router.push('/')
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    router.push('/login')
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Matches</h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Welcome, {userData?.displayName || user.email}
          </p>
        </div>
        <Button onClick={handleLogout} variant="outline" className="h-11 sm:h-9">
          Sign Out
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Matches</CardTitle>
          <CardDescription>
            Match management will be available in Phase 3
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-zinc-600 dark:text-zinc-400">
            No matches available yet. Check back soon!
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
