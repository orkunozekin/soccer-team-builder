import { Suspense } from 'react'
import { PageLoadingSkeleton } from '@/components/LoadingSkeleton'
import JoinPageClient from './JoinPageClient'

export default function JoinPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton variant="centered" />}>
      <JoinPageClient />
    </Suspense>
  )
}
