'use client'

import {
  Calendar,
  type LucideIcon,
  MailPlus,
  Settings,
  Users,
} from 'lucide-react'
import { SidenavLink } from '@/components/layout/SidenavLink'
import type { ClubWorkspaceSection } from '@/lib/hooks/useClubWorkspace'
import type { ClubSubNavSection } from '@/lib/utils/resolveSelectedClub'

const CLUB_SECTION_ICONS: Record<ClubSubNavSection, LucideIcon> = {
  matches: Calendar,
  roster: Users,
  invites: MailPlus,
  settings: Settings,
}

export function ClubNav({
  sections,
  activeHref,
  onNavigate,
}: {
  sections: ClubWorkspaceSection[]
  activeHref?: string
  onNavigate?: () => void
}) {
  if (sections.length === 0) return null

  return (
    <nav aria-label="Club sections" className="flex flex-col gap-1">
      {sections.map(section => (
        <SidenavLink
          key={section.id}
          href={section.href}
          label={section.label}
          icon={CLUB_SECTION_ICONS[section.id]}
          active={section.href === activeHref}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  )
}
