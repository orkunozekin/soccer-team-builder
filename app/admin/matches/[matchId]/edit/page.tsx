'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AdminRouteGuard } from '@/components/admin/AdminRouteGuard'

function EditMatchRedirect() {
  const router = useRouter()
  const params = useParams()
  const matchId = params?.matchId as string

  useEffect(() => {
    if (matchId) {
      router.replace(`/admin/matches/${matchId}`)
    }
  }, [matchId, router])

  return null
}

export default function EditMatchPage() {
  return (
    <AdminRouteGuard>
      <EditMatchRedirect />
    </AdminRouteGuard>
  )
}
