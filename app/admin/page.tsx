'use client'

import Link from 'next/link'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const SECTIONS = [
  {
    href: '/admin/matches',
    title: 'Matches',
    description: 'Create matches, manage RSVPs, teams, and attendance',
  },
  {
    href: '/admin/users',
    title: 'Users',
    description: 'View player profiles, change roles, and remove users',
  },
] as const

export default function AdminPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Admin
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Choose a section to manage
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map(section => (
          <Link key={section.href} href={section.href} className="group block">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-xl group-hover:underline group-hover:underline-offset-4">
                  {section.title}
                </CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {section.description}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
