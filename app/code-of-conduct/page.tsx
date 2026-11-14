import type { Metadata } from 'next'
import { CodeOfConductContent } from '@/components/conduct/CodeOfConductContent'
import { PageHeader } from '@/components/layout/PageHeader'

export const metadata: Metadata = {
  title: 'Code of conduct',
}

export default function CodeOfConductPage() {
  return (
    <div className="container mx-auto max-w-xl px-4 py-8 sm:py-10">
      <PageHeader
        size="md"
        title="Code of conduct"
        description="Clubs can ask members to agree to this before their first RSVP. You agree once, and it covers every club."
      />
      <CodeOfConductContent headingLevel="h2" className="text-base" />
    </div>
  )
}
