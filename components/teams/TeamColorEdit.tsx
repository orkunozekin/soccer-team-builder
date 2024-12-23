import { Team, TeamColor } from '@/interfaces/Team.interface'
import { capitalizeFirstLetter } from '@/lib/stringUtils'
import { cn } from '@/lib/utils'
import useTeamsStore from '@/store/useTeamsStore'
import React from 'react'

type Props = {
  team: Team
}

export default function TeamColorEdit({ team }: Props) {
  const { editTeamColor, teams } = useTeamsStore()
  const colors = {
    ORANGE: 'bg-pinny-orange',
    GREEN: 'bg-pinny-green',
    BLUE: 'bg-pinny-blue',
    RED: 'bg-red-60',
  }

  //unassigned colors
  const otherTeamColors = Object.keys(colors).filter(color =>
    teams.every(team => team.color !== color)
  ) as TeamColor[]

  return (
    <section className="flex items-center gap-2">
      <p className="font-semibold text-white">Change color:</p>
      <section className="flex gap-2">
        {otherTeamColors.map(color => {
          const availableColor = capitalizeFirstLetter(color.toLowerCase())
          return (
            <p
              className={cn(
                'rounded-md border border-white p-1',
                colors[color]
              )}
              onClick={() => editTeamColor(team.id, color)}
            >
              {availableColor}
            </p>
          )
        })}
      </section>
    </section>
  )
}
