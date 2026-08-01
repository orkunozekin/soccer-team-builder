'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function EditMatchPage() {
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
