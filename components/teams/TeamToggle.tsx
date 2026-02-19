'use client'

import { Team } from '@/types/team'

interface TeamToggleProps {
  teams: Team[]
  selectedIndex: number
  onSelect: (index: number) => void
}

export function TeamToggle({ teams, selectedIndex, onSelect }: TeamToggleProps) {
  return (
    <div className="flex gap-2 justify-center">
      {teams.map((team, index) => (
        <button
          key={team.id}
          onClick={() => onSelect(index)}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            selectedIndex === index
              ? 'bg-primary text-primary-foreground'
              : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
          }`}
        >
          {team.name || `Team ${team.teamNumber}`}
        </button>
      ))}
    </div>
  )
}
