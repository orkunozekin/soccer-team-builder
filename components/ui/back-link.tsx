import { ArrowLeft } from 'lucide-react'
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
        'mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground',
        className
      )}
    >
      <ArrowLeft className="h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden />
      {label}
    </Link>
  )
}
