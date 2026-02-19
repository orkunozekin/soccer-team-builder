import Link from 'next/link'
import { cn } from '@/lib/utils'

interface BackLinkProps {
  href: string
  label: string
  className?: string
}

export function BackLink({ href, label, className }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'mb-4 inline-flex items-center text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors',
        className
      )}
    >
      ← {label}
    </Link>
  )
}

