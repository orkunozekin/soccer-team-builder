'use client'

import { MatchDetailView } from '@/components/matches/MatchDetailView'

export default function AdminMatchPage() {
  return (
    <MatchDetailView
      backLink={{ href: '/matches', label: 'Back to Matches' }}
    />
  )
}
