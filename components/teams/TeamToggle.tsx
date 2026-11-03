'use client'

import { Team } from '@/types/team'

interface TeamToggleProps {
  teams: Team[]
  selectedIndex: number
  onSelect: (index: number) => void
}

export function TeamToggle({
  teams,
  selectedIndex,
  onSelect,
}: TeamToggleProps) {
  return (
    <div className="flex justify-center gap-2">
      {teams.map((team, index) => (
        <button
          key={team.id}
          onClick={() => onSelect(index)}
          className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
            selectedIndex === index
              ? 'bg-primary text-primary-foreground'
              : 'bg-accent text-[#B9C2BD]'
          }`}
        >
          {team.name || `Team ${team.teamNumber}`}
        </button>
      ))}
    </div>
  )
}
